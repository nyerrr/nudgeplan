from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

app = FastAPI(title="NudgePlan API")

api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

class TaskRequest(BaseModel):
    text: str

class TaskResponse(BaseModel):
    tasks: list
    breakdown: str

@app.get("/")
def root():
    return {"status": "ok", "message": "NudgePlan API"}

@app.post("/ai/plan", response_model=TaskResponse)
async def plan_tasks(req: TaskRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"""
        You are a task planning assistant. Break down the following brain dump into actionable tasks.
        For each task, suggest micro-steps if large.
        Return a structured response with tasks and a breakdown.
        
        Input: {req.text}
        """
        response = model.generate_content(prompt)
        return {
            "tasks": ["Breakdown from AI"],
            "breakdown": response.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
