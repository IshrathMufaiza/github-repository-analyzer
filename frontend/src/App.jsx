import { useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <div>
        <div className="metric-value">{value}</div>
        <div className="metric-label">{label}</div>
      </div>
    </div>
  );
}

function App() {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [repository, setRepository] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyzeRepository(event) {
    event?.preventDefault();

    if (!repositoryUrl.trim()) {
      setError("Enter a GitHub repository URL.");
      return;
    }

    setLoading(true);
    setError("");
    setRepository(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/repository?url=${encodeURIComponent(
          repositoryUrl.trim()
        )}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to analyze repository."
        );
      }

      setRepository(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const scoreClass =
    repository?.healthScore >= 80
      ? "score-good"
      : repository?.healthScore >= 60
      ? "score-ok"
      : "score-risk";

  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">DEVELOPER TOOL</div>
        <h1>Repository Health Analyzer</h1>
        <p>
          Turn GitHub repository data into a quick, explainable picture
          of activity, collaboration, and maintenance risk.
        </p>

        <form className="search" onSubmit={analyzeRepository}>
          <input
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            placeholder="https://github.com/owner/repository"
            aria-label="GitHub repository URL"
          />
          <button disabled={loading}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </form>

        {error && <div className="error">{error}</div>}
      </section>

      {repository && (
        <section className="report">
          <div className="repo-header">
            <div>
              <div className="repo-path">{repository.fullName}</div>
              <h2>{repository.name}</h2>
              <p>
                {repository.description || "No description provided."}
              </p>
            </div>
            <div className="repo-type">
              {repository.ownerType === "User"
                ? "👤 Personal"
                : "🏢 Organization"}
            </div>
          </div>

          <div className="metrics">
            <Metric icon="⭐" label="Stars" value={repository.stars} />
            <Metric icon="🍴" label="Forks" value={repository.forks} />
            <Metric
              icon="🐛"
              label="Open issues"
              value={repository.openIssues}
            />
            <Metric
              icon="📈"
              label="Commits / 30d"
              value={repository.recentCommits}
            />
            <Metric
              icon="👥"
              label="Contributors"
              value={repository.contributorCount}
            />
            <Metric
              icon="💻"
              label="Primary language"
              value={repository.language || "Unknown"}
            />
          </div>

          <div className="analysis-grid">
            <div className="card score-card">
              <div className="card-title">Repository health</div>
              <div className={`score ${scoreClass}`}>
                {repository.healthScore}
                <span>/100</span>
              </div>
              <div className="health-label">
                {repository.healthLabel}
              </div>
              <div className="score-bar">
                <div
                  style={{
                    width: `${repository.healthScore}%`
                  }}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-title">Activity</div>
              <div className="big-number">
                {repository.activityScore}
                <span>/100</span>
              </div>
              <p className="muted">
                Based on recent commits, contributor breadth,
                stars, and forks.
              </p>
            </div>

            <div className="card">
              <div className="card-title">
                Contribution concentration
              </div>
              <div className="big-number">
                {repository.contributionConcentration == null
                  ? "N/A"
                  : `${repository.contributionConcentration}%`}
              </div>
              <p className="muted">
                Share of returned contributions made by the top
                contributor.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-title">What stands out</div>
            <div className="indicators">
              {repository.indicators.map((indicator, index) => (
                <div
                  className={`indicator ${indicator.type}`}
                  key={index}
                >
                  <span>
                    {indicator.type === "positive"
                      ? "✓"
                      : indicator.type === "warning"
                      ? "!"
                      : "•"}
                  </span>
                  {indicator.text}
                </div>
              ))}
            </div>
          </div>

          <div className="details">
            <div className="card">
              <div className="card-title">Repository profile</div>
              <dl>
                <div>
                  <dt>Owner</dt>
                  <dd>{repository.owner}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>
                    {repository.ownerType === "User"
                      ? "Personal"
                      : "Organization"}
                  </dd>
                </div>
                <div>
                  <dt>Age</dt>
                  <dd>{repository.repositoryAgeDays} days</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>
                    {new Date(
                      repository.updatedAt
                    ).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="card">
              <div className="card-title">Top contributors</div>
              <div className="contributors">
                {repository.contributors
                  .slice(0, 5)
                  .map((contributor) => (
                    <div
                      className="contributor"
                      key={contributor.username}
                    >
                      <span>@{contributor.username}</span>
                      <strong>{contributor.contributions}</strong>
                    </div>
                  ))}

                {repository.contributors.length === 0 && (
                  <p className="muted">
                    No contributor history available.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <footer>
        <div>© 2026 Repository Health Analyzer. All rights reserved.</div>
        <span>Built with React, Express, Octokit, and the GitHub App API.</span>
      </footer>
    </main>
  );
}

export default App;
