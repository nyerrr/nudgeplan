# NudgePlan Backend (FastAPI)

## Setup
1. Create virtual environment
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
```

2. Install dependencies
```bash
pip install -r requirements.txt
```

3. Configure environment
```bash
cp .env.example .env
# Add your GEMINI_API_KEY
```

4. Run server
```bash
uvicorn main:app --reload
```

Server runs at http://localhost:8000
Docs at http://localhost:8000/docs
