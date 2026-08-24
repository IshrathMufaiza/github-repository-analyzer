# GitHub Repository Analyzer

A full-stack web application that analyzes GitHub repositories and turns repository activity, collaboration, and metadata into an easy-to-understand health report.

## 🚀 Live Demo

**[Repository Health Analyzer](https://github-repository-analyzer-xi.vercel.app)**

Paste a GitHub repository URL to view its repository health and activity analysis.

## ✨ Features

- 📊 Repository health analysis dashboard
- ⭐ Repository metadata including stars, forks, issues, language, and dates
- 📈 Recent 30-day commit activity
- 👥 Contributor analysis
- 📌 Contribution concentration analysis
- 🏢 Personal vs. organization repository detection
- 🔍 Explainable repository health indicators
- 🔐 GitHub App-based authentication for authorized repositories
- ⚡ Short-lived GitHub App installation tokens
- 💾 Five-minute server-side analysis cache
- 📱 Responsive React interface
- 🌐 Deployed frontend and backend

## 🧠 How It Works

1. The user enters a GitHub repository URL.
2. The backend validates and extracts the repository owner and name.
3. The application determines the appropriate GitHub API access method.
4. Repository metadata, commit activity, and contributor information are retrieved.
5. The backend calculates repository health indicators, including contribution concentration.
6. The results are presented through an interactive dashboard.

For repositories requiring authorization, the application uses a GitHub App installation rather than exposing a personal GitHub access token.

## 🔐 GitHub App & Security

The application uses a GitHub App to securely access repositories that require authorization.

GitHub App installation tokens are:

- Short-lived
- Scoped to the repositories granted to the application
- Generated server-side
- Never exposed to the frontend

Sensitive credentials such as the GitHub App private key are stored as environment variables in production and are never committed to the repository.

## 🛠️ Tech Stack

### Frontend
- React.js
- Vite
- JavaScript
- CSS

### Backend
- Node.js
- Express.js
- Axios
- Octokit

### GitHub Integration
- GitHub Apps
- GitHub REST API
- Installation access tokens

### Deployment
- Vercel — Frontend
- Render — Backend

## 📁 Project Structure

```text
github-repository-analyzer/
│
├── backend/
│   ├── server.js
│   ├── package.json
│   └── ...
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── .gitignore
└── README.md
