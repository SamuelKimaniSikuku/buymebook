# 🚀 GitHub Setup Guide

Follow these steps to upload your "Buy Me a Book" platform to GitHub and make it live!

## Method 1: Using GitHub Website (Easiest - No Command Line)

### Step 1: Create a GitHub Account
1. Go to [github.com](https://github.com)
2. Click "Sign up" and create your account
3. Verify your email

### Step 2: Create a New Repository
1. Click the "+" icon in the top-right corner
2. Select "New repository"
3. Repository settings:
   - **Repository name**: `buy-me-a-book`
   - **Description**: "A platform connecting book lovers - request books or donate to others"
   - **Visibility**: Public (required for free GitHub Pages)
   - **Initialize**: Check "Add a README file" (we'll replace it)
4. Click "Create repository"

### Step 3: Upload Your Files
1. In your repository, click "Add file" → "Upload files"
2. Drag and drop ALL these files:
   - `buy-me-a-book.html`
   - `index.html`
   - `README.md`
   - `LICENSE`
   - `.gitignore`
3. Add commit message: "Initial commit - Buy Me a Book platform"
4. Click "Commit changes"

### Step 4: Enable GitHub Pages
1. In your repository, click "Settings"
2. Scroll down and click "Pages" in the left sidebar
3. Under "Source":
   - Branch: Select **main**
   - Folder: Select **/ (root)**
4. Click "Save"
5. Wait 1-2 minutes for deployment
6. Your site will be live at: `https://YOUR-USERNAME.github.io/buy-me-a-book/`

### Step 5: Update README with Your Live Link
1. Click on `README.md` in your repository
2. Click the pencil icon (Edit)
3. Find the line: `Visit the live site: [Your GitHub Pages URL will go here]`
4. Replace with: `Visit the live site: [https://YOUR-USERNAME.github.io/buy-me-a-book/](https://YOUR-USERNAME.github.io/buy-me-a-book/)`
5. Also update `[Your Email]` with your actual email
6. Click "Commit changes"

---

## Method 2: Using Git Command Line (For Developers)

### Prerequisites
- Install Git: [git-scm.com/downloads](https://git-scm.com/downloads)
- Have a GitHub account

### Step 1: Initialize Git Repository Locally
```bash
# Navigate to your project folder
cd /path/to/your/project

# Initialize git
git init

# Add all files
git add .

# Make first commit
git commit -m "Initial commit - Buy Me a Book platform"
```

### Step 2: Create GitHub Repository
1. Go to [github.com/new](https://github.com/new)
2. Create repository named `buy-me-a-book`
3. Don't initialize with README (we already have one)

### Step 3: Connect and Push
```bash
# Add GitHub as remote
git remote add origin https://github.com/YOUR-USERNAME/buy-me-a-book.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 4: Enable GitHub Pages
Follow Step 4 from Method 1 above.

---

## 📝 After Publishing

### Test Your Live Site
1. Visit your GitHub Pages URL
2. Test all features:
   - Submit a book request
   - Browse requests
   - Click the Amazon gift button
   - Check responsive design on mobile

### Share Your Platform
- Share the link on social media
- Add it to your portfolio
- Submit to platforms like Product Hunt
- Share in book lover communities

### Monitor Your Site
- Check the "Insights" tab for traffic
- Track Amazon affiliate earnings in your Amazon Associates account

---

## 🔧 Making Updates Later

### Using GitHub Website:
1. Navigate to the file you want to edit
2. Click the pencil icon
3. Make your changes
4. Commit changes
5. GitHub Pages auto-updates in 1-2 minutes

### Using Git Command Line:
```bash
# Make your changes to files
git add .
git commit -m "Description of changes"
git push
```

---

## 🆘 Troubleshooting

### Site Not Loading?
- Wait 2-3 minutes after enabling Pages
- Check Settings → Pages to see if it says "Your site is live"
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)

### Amazon Links Not Working?
- Make sure your affiliate ID `samuelkimanis-20` is correctly set
- Verify you're approved in Amazon Associates program

### Want to Use a Custom Domain?
1. Buy a domain (Namecheap, GoDaddy, etc.)
2. In GitHub Settings → Pages, add your custom domain
3. Configure DNS settings with your domain provider
4. Follow [GitHub's custom domain guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

---

## 🎉 You're Done!

Your "Buy Me a Book" platform is now live and accessible to anyone on the internet!

**Next Steps:**
- Share the link with friends and social media
- Monitor book requests and donations
- Track affiliate earnings
- Consider adding a backend for production use

---

Need help? Open an issue in your repository or contact support!
