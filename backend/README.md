# NudgePlan Backend (FastAPI + Gemini)

## Setup (Windows / PowerShell)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` and paste your key from [Google AI Studio](https://aistudio.google.com/apikey):

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
```

## Run

```powershell
uvicorn main:app --reload
```

- API root: http://localhost:8000
- Health check: http://localhost:8000/health
- Interactive docs: http://localhost:8000/docs

## Test the AI request

In a second terminal (with the venv activated):

```powershell
python test_gemini.py
```

This posts a sample brain dump to `/ai/plan` and prints the micro-steps returned by Gemini.

You can also test by hand:

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/ai/plan" -Method Post `
  -ContentType "application/json" `
  -Body '{"text": "Finish my report, do laundry, and go to the gym"}'
```

## Endpoints

| Method | Path      | Description                                  |
| ------ | --------- | -------------------------------------------- |
| GET    | `/`       | Service status and Gemini config flag        |
| GET    | `/health` | Health check with active model               |
| POST   | `/ai/plan`| Brain dump -> micro-steps via Gemini         |

### Request

```json
{ "text": "Finish my report, do laundry, and go to the gym" }
```

### Response

```json
{
  "tasks": ["Draft the report outline", "Do one laundry load", "Gym: 20 minute session"],
  "breakdown": "Split the report into outline and body, batch chores, keep the gym short.",
  "raw": "{...}"
}
```
