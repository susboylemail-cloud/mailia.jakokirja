@echo off
echo Adding changes to git...
git add api.js app.js
git commit -m "Fix WebSocket reconnection and event listener duplication issues"
echo Pushing to Heroku...
git push heroku main
echo Deployment complete!
pause
