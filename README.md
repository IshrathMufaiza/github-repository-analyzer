# GitHub Repository Analyzer

A GitHub App that turns repository data into an explainable health report.

## Features
- GitHub App installation authentication
- Repository metadata
- Recent 30-day commit activity
- Contributor count and contribution concentration
- Personal vs organization repository detection
- Explainable health indicators
- Responsive React dashboard
- Short-lived Octokit installation authentication
- Five-minute server-side analysis cache

## Local setup

### Backend
```bash
cd backend
npm install
copy .env.example .env
```

Set your GitHub App ID and private-key path in `.env`, then:
```bash
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Never commit `.env` or your GitHub App `.pem` private key.
