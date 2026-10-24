# Codex in Codespaces: datacenter-twin-lab

[Create a separate Codespace for this repository](https://github.com/codespaces/new?repo=mohammadrezwankhan%2Fdatacenter-twin-lab&ref=codespaces%2Fcodex&devcontainer_path=.devcontainer%2Fcodex%2Fdevcontainer.json)

Choose the `codespaces/codex` branch and the **Codex - datacenter-twin-lab** dev container. The first build installs Codex CLI 0.164.0, the Codex editor extension, Node 24, Python 3.12, and the project dependencies listed below. This configuration uses GitHub's default universal container image.

## Sign in and edit

Open a terminal in the repository and run:

```bash
codex login --device-auth
codex
```

Follow the printed sign-in link using your ChatGPT account. Device code login may need to be enabled in your ChatGPT security settings or by your workspace administrator. Sign-in credentials stay in your Codespace; do not commit them. The Codex sidebar uses the same account cache as the CLI. If the sidebar is unavailable in the browser editor, use the terminal CLI.

Ask Codex: “Read AGENTS.md and README.md, explain how this project runs, then help me make and test a focused change.”

## Project setup and commands

- Python environment: `./.venv`. Activate with `source .venv/bin/activate`.
- Node project: `apps/web`; dependencies installed with `npm`.
  Available commands from that directory: `npm run dev`, `npm run build`.

See [the repository README](../../README.md) and existing contributor instructions for the authoritative application startup, test commands, and optional services. Database-backed apps may require their documented local database or Docker Compose setup. No app server, database migration, deployment, or external model provider is started automatically.

## Preview, save, and stop

Use the **Ports** panel to open a running app. Ports default to **Private**; keep them private when using personal data. For Vite, pass `--host 0.0.0.0` if required. Use the project's documented host setting if it validates forwarded hostnames.

Review `git diff`, commit your edits, and push them to your branch. Stop the Codespace from [your Codespaces page](https://github.com/codespaces) when finished; stopped environments still consume storage. Delete it after pushing any work you need.

To retry setup, run `bash .devcontainer/codex/setup.sh`. Installing dependencies may need internet access. For CLI updates, run `npm install --global @openai/codex@latest`.

References: [Codex CLI](https://learn.chatgpt.com/docs/codex/cli), [Codex authentication](https://learn.chatgpt.com/docs/auth), [GitHub dev containers](https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/adding-a-dev-container-configuration/introduction-to-dev-containers).
