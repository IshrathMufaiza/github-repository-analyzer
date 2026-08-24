require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { App } = require("octokit");

const githubApp = new App({
  appId: Number(process.env.GITHUB_APP_ID),
  privateKey: fs.readFileSync(
    path.resolve(process.env.GITHUB_PRIVATE_KEY_PATH),
    "utf8"
  )
});

const app = express();
const PORT = Number(process.env.PORT || 5001);
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

app.use(cors());
app.use(express.json());

function parseRepositoryUrl(value) {
  const parsed = new URL(value);

  if (parsed.hostname.toLowerCase() !== "github.com") {
    throw new Error("Please provide a valid GitHub repository URL");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);

  if (parts.length < 2) {
    throw new Error("Invalid GitHub repository URL");
  }

  return {
    owner: parts[0],
    repo: parts[1].replace(/\.git$/, "")
  };
}

async function getInstallationOctokit(owner, repo) {
  // An installation ID must NOT be hard-coded. Different GitHub accounts
  // have different installations of the same GitHub App.
  const response = await githubApp.octokit.request(
    "GET /repos/{owner}/{repo}/installation",
    {
      owner,
      repo,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  return githubApp.getInstallationOctokit(response.data.id);
}

async function getRepositoryClient(owner, repo) {
  // First look for an installation of OUR GitHub App on this repository.
  // This is what lets the same public app work for different GitHub accounts.
  try {
    const installationOctokit = await getInstallationOctokit(owner, repo);
    return { type: "app", client: installationOctokit };
  } catch (error) {
    const status = error.status || error.response?.status;

    // If the App is not installed on this repository, fall back to the
    // unauthenticated public API. This still allows public repositories to
    // be analyzed without forcing every user to install the App.
    if (status !== 404) {
      throw error;
    }
  }

  try {
    await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Repository-Health-Analyzer"
      }
    });

    return { type: "public", client: axios };
  } catch (error) {
    // A 404 here means either the repository does not exist or it is private
    // and the user has not installed/granted our GitHub App access to it.
    throw error;
  }
}

async function requestRepositoryData(clientInfo, owner, repo, since) {
  if (clientInfo.type === "public") {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Repository-Health-Analyzer"
    };

    const requests = [
      axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/commits`, {
        headers,
        params: { since: since.toISOString(), per_page: 100 }
      }),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/contributors`, {
        headers,
        params: { per_page: 100 }
      })
    ];

    const [repository, commits, contributors] = await Promise.all(requests);
    return {
      repository: repository.data,
      commits: commits.data,
      contributors: contributors.data
    };
  }

  const octokit = clientInfo.client;
  const [repository, commits, contributors] = await Promise.all([
    octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
      headers: { "X-GitHub-Api-Version": "2022-11-28" }
    }),
    octokit.request("GET /repos/{owner}/{repo}/commits", {
      owner,
      repo,
      since: since.toISOString(),
      per_page: 100,
      headers: { "X-GitHub-Api-Version": "2022-11-28" }
    }),
    octokit.request("GET /repos/{owner}/{repo}/contributors", {
      owner,
      repo,
      per_page: 100,
      headers: { "X-GitHub-Api-Version": "2022-11-28" }
    })
  ]);

  return {
    repository: repository.data,
    commits: commits.data,
    contributors: contributors.data
  };
}

async function analyzeRepository(owner, repo) {
  const clientInfo = await getRepositoryClient(owner, repo);

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { repository: repositoryData, commits: commitsData, contributors: contributorData } =
    await requestRepositoryData(clientInfo, owner, repo, since);

  const totalContributions = contributorData.reduce(
    (sum, contributor) => sum + (contributor.contributions || 0),
    0
  );

  const topContributor = contributorData[0];

  const contributionConcentration =
    totalContributions > 0 && topContributor
      ? Number(
          ((topContributor.contributions / totalContributions) * 100).toFixed(1)
        )
      : null;

  const recentCommits = commitsData.length;

  const repositoryAgeDays = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(repositoryData.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const activityScore = Math.min(
    100,
    Math.round(
      Math.min(recentCommits, 50) * 1.5 +
      Math.min(contributorData.length, 20) * 1.5 +
      (repositoryData.stargazers_count > 0 ? 10 : 0) +
      (repositoryData.forks_count > 0 ? 5 : 0)
    )
  );

  const concentrationPenalty =
    contributionConcentration === null
      ? 0
      : contributionConcentration > 80 && contributorData.length > 1
      ? 15
      : contributionConcentration > 60 && contributorData.length > 1
      ? 8
      : 0;

  const healthScore = Math.max(
    0,
    Math.min(100, activityScore - concentrationPenalty)
  );

  const healthLabel =
    healthScore >= 80
      ? "Healthy"
      : healthScore >= 60
      ? "Good"
      : healthScore >= 40
      ? "Needs attention"
      : "At risk";

  const indicators = [];

  if (recentCommits >= 10) {
    indicators.push({ type: "positive", text: "Strong recent activity" });
  } else if (recentCommits === 0) {
    indicators.push({ type: "warning", text: "No commits in the last 30 days" });
  } else {
    indicators.push({ type: "neutral", text: "Moderate recent activity" });
  }

  if (contributorData.length >= 3) {
    indicators.push({ type: "positive", text: "Multiple contributors" });
  } else if (contributorData.length === 1) {
    indicators.push({ type: "neutral", text: "Single-contributor repository" });
  } else {
    indicators.push({ type: "neutral", text: "No contributor history available" });
  }

  if (contributionConcentration !== null && contributorData.length > 1) {
    if (contributionConcentration > 80) {
      indicators.push({ type: "warning", text: "High contribution concentration" });
    } else if (contributionConcentration > 60) {
      indicators.push({ type: "warning", text: "Moderate contribution concentration" });
    } else {
      indicators.push({
        type: "positive",
        text: "Contributions are reasonably distributed"
      });
    }
  }

  return {
    name: repositoryData.name,
    fullName: repositoryData.full_name,
    owner: repositoryData.owner.login,
    ownerType: repositoryData.owner.type,
    description: repositoryData.description,
    stars: repositoryData.stargazers_count,
    forks: repositoryData.forks_count,
    openIssues: repositoryData.open_issues_count,
    language: repositoryData.language,
    createdAt: repositoryData.created_at,
    updatedAt: repositoryData.updated_at,
    repositoryAgeDays,
    recentCommits,
    contributorCount: contributorData.length,
    contributors: contributorData.map((contributor) => ({
      username: contributor.login,
      contributions: contributor.contributions
    })),
    contributionConcentration,
    healthScore,
    healthLabel,
    activityScore,
    indicators
  };
}

app.get("/api/test", (_req, res) => {
  res.json({
    success: true,
    message: "Backend is running."
  });
});

app.get("/api/repository", async (req, res) => {
  try {
    if (!req.query.url) {
      return res.status(400).json({
        message: "Repository URL is required"
      });
    }

    let owner;
    let repo;

    try {
      ({ owner, repo } = parseRepositoryUrl(req.query.url));
    } catch (error) {
      return res.status(400).json({
        message: error.message
      });
    }

    const cacheKey = `${owner}/${repo}`.toLowerCase();
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.createdAt < CACHE_TTL) {
      return res.json({
        ...cached.data,
        cached: true
      });
    }

    const data = await analyzeRepository(owner, repo);

    cache.set(cacheKey, {
      data,
      createdAt: Date.now()
    });

    res.json({
      ...data,
      cached: false
    });
  } catch (error) {
    console.error("========== GITHUB API ERROR ==========");
console.error("Message:", error.message);
console.error("Status:", error.status || error.response?.status);
console.error("Data:", error.response?.data);
console.error("URL:", error.config?.url);
console.error("======================================");

    const status = error.status || error.response?.status;

    if (status === 404) {
      return res.status(404).json({
        message:
          "Repository not found, or it is private and the GitHub App is not installed on it."
      });
    }

    if (status === 403) {
      return res.status(403).json({
        message:
          "GitHub denied access. Make sure the GitHub App is installed on this repository and has the required read permissions."
      });
    }

    res.status(500).json({
      message: "Failed to analyze repository"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
