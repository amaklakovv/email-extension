import os
import json
from fastapi import FastAPI, HTTPException
import asyncio
from pydantic import BaseModel, ValidationError
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Configure the Gemini API
try:
    api_key = os.environ["GEMINI_API_KEY"]
    if not api_key:
        raise KeyError
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
except KeyError:
    print("ERROR: GEMINI_API_KEY environment variable not set.")
    model = None
except Exception as e:
    print(f"Error configuring Gemini: {e}")
    model = None

# Define the data models for robust API validation
class Email(BaseModel):
    subject: str
    sender: str
    body: str

class SummaryResponse(BaseModel):
    summary: str
    reply_draft: str

@app.get("/health")
def read_root():
    return {"status": "ok"}

# Create the endpoint to summarise an email
@app.post("/summarize", response_model=list[SummaryResponse])
async def summarize_emails(emails: list[Email]) -> list[SummaryResponse]:
    if not model:
        raise HTTPException(status_code=500, detail="Gemini API not configured. Check GEMINI_API_KEY.")

    async def generate_single_summary(email: Email):
        prompt = f"""
        Analyze the following email and provide a concise summary and a polite, brief reply draft.
        Return the output as a single, clean JSON object with two keys: "summary" and "reply_draft".

        Email from: {email.sender}
        Subject: {email.subject}
        Body: {email.body}
        """
        generation_config = genai.GenerationConfig(response_mime_type="application/json")
        return await model.generate_content_async(prompt, generation_config=generation_config)

    try:
        # Create and run all summarisation tasks concurrently
        tasks = [generate_single_summary(email) for email in emails]
        responses = await asyncio.gather(*tasks)

        # Process responses
        summaries = [SummaryResponse(**json.loads(res.text)) for res in responses]
        return summaries
    except (json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(status_code=500, detail=f"Error parsing Gemini's response: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred with the Gemini API: {e}")
