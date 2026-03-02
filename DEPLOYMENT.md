# Deployment & Setup Guide

This guide will help you deploy the SuperDoc + Cursor integration to the public GitHub repository.

## 📦 Repository Setup

### 1. Initialize Git Repository (if not already done)

```bash
cd docx-viewer
git init
git add .
git commit -m "Initial commit: SuperDoc + Cursor DOCX editor"
```

### 2. Add Remote Repository

```bash
git remote add origin https://github.com/tsondag/superdoc-cursor.git
```

### 3. Push to GitHub

```bash
git branch -M main
git push -u origin main
```

## 📁 Files to Include in Repository

The repository should include:

- ✅ `README.md` (GitHub-specific README - use README-GITHUB.md)
- ✅ `SKILL.md` (Cursor skill file)
- ✅ `LICENSE` (MIT license)
- ✅ `package.json` (dependencies)
- ✅ `vite.config.js` (Vite configuration)
- ✅ `index.html` (HTML template)
- ✅ `.gitignore` (ignore node_modules, etc.)
- ✅ `src/App.jsx` (main editor component)
- ✅ `src/main.jsx` (React entry point)

**Files to exclude:**
- ❌ `node_modules/` (via .gitignore)
- ❌ `dist/` (via .gitignore)
- ❌ Local README.md (replaced with README-GITHUB.md)

## 🔄 Pre-Deployment Checklist

Before pushing to GitHub:

- [ ] Rename `README-GITHUB.md` to `README.md`
- [ ] Verify `.gitignore` includes `node_modules/`
- [ ] Test `npm install` in fresh directory
- [ ] Test `npm run dev` works
- [ ] Verify SKILL.md references correct repo URL
- [ ] Ensure LICENSE file is present
- [ ] Remove any sensitive information from code

## 🚀 Publishing the Skill

### Option 1: Users Install Manually

Users copy SKILL.md to their Cursor skills directory:

```bash
mkdir -p ~/.cursor/skills/superdoc-cursor
curl -o ~/.cursor/skills/superdoc-cursor/SKILL.md \
  https://raw.githubusercontent.com/tsondag/superdoc-cursor/main/SKILL.md
```

### Option 2: Users Clone the Repo

Users clone the entire repo:

```bash
git clone https://github.com/tsondag/superdoc-cursor.git

# Install skill
mkdir -p ~/.cursor/skills/superdoc-cursor
cp superdoc-cursor/SKILL.md ~/.cursor/skills/superdoc-cursor/

# Run the app
cd superdoc-cursor
npm install
npm run dev
```

## 📝 Repository Settings

### GitHub Repository Settings

1. **Description:** "AI-powered DOCX editor with Cursor integration. Edit Word documents with tracked changes, direct file access, and intelligent automation."

2. **Topics/Tags:**
   - `cursor-ai`
   - `docx`
   - `word-editor`
   - `mcp`
   - `model-context-protocol`
   - `react`
   - `vite`
   - `superdoc`
   - `document-editing`
   - `ai-assistant`

3. **Website:** https://superdoc.dev

4. **License:** MIT

### Enable GitHub Features

- ✅ Issues (for bug reports and feature requests)
- ✅ Discussions (for Q&A and community)
- ✅ Wiki (optional - for extended documentation)
- ✅ Projects (optional - for roadmap)

## 📢 Sharing the Skill

### In Cursor Community

Share in Cursor community forums/Discord:

> **SuperDoc + Cursor: AI-Powered DOCX Editing**
>
> I've created a skill for editing DOCX files directly in Cursor with visual tracked changes and AI-assisted automation.
>
> **Features:**
> - Direct local file editing (no upload/download)
> - Browser-based visual editor
> - Tracked changes with accept/decline buttons
> - AI-powered document automation via MCP
>
> **GitHub:** https://github.com/tsondag/superdoc-cursor
>
> **Quick start:**
> ```bash
> git clone https://github.com/tsondag/superdoc-cursor.git
> cd superdoc-cursor
> npm install && npm run dev
> ```

### On Social Media

**Twitter/X:**
```
🚀 Just released a new @cursor_ai skill for editing Word documents!

✨ Features:
• Visual DOCX editor in browser
• AI-powered tracked changes
• Direct local file editing
• No upload/download needed

Perfect for contracts, grants, and document automation.

https://github.com/tsondag/superdoc-cursor
```

**LinkedIn:**
```
I've built a new integration between Cursor AI and SuperDoc that enables intelligent Word document editing with visual feedback.

Key capabilities:
• Browser-based DOCX editor with tracked changes
• AI suggests edits that you can accept/decline
• Changes save directly to your local files
• Perfect for contract review, grant writing, and document automation

It's open source and ready to use. Check it out on GitHub!
```

## 🔧 Maintenance

### Updating the Skill

When you make updates:

1. Update files in the repo
2. Commit and push changes
3. Tag releases for major versions:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

### Handling Issues

When users report issues:
1. Thank them for the report
2. Ask for reproduction steps
3. Fix the issue
4. Update the README/SKILL if needed
5. Close the issue with explanation

### Feature Requests

When users request features:
1. Label as "enhancement"
2. Discuss feasibility
3. Implement if valuable
4. Update documentation

## 📊 Success Metrics

Track these to measure adoption:
- GitHub stars ⭐
- Forks 🍴
- Issues and PRs
- Discussions activity
- Clones/downloads

## 🎯 Next Steps

After deployment:

1. **Share widely** - Cursor community, social media, forums
2. **Monitor feedback** - Respond to issues and questions
3. **Iterate** - Improve based on user feedback
4. **Document use cases** - Add examples to README
5. **Create video demo** - Visual walkthroughs help adoption

## ❓ Common Questions

### Q: Do users need a SuperDoc license?

**A:** No, SuperDoc is free for personal use. The MCP server runs locally.

### Q: Will this work with other AI editors?

**A:** The skill is designed for Cursor, but the MCP server works with any MCP-compatible client.

### Q: Can I use this in production workflows?

**A:** Yes! It's production-ready. However, always keep backups of important documents.

### Q: How do I update the skill?

**A:** Users can pull the latest changes from GitHub and re-copy SKILL.md to their skills directory.

---

**Ready to deploy?** Follow the steps above to push to GitHub and share with the community! 🚀
