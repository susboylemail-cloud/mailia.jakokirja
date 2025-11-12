# Set Mapon API key in Heroku config
heroku config:set MAPON_API_KEY=b6a5ce738b76b134d06e8b072a754918019a9ed7

# Verify it's set
heroku config:get MAPON_API_KEY

# Check all config vars
heroku config
