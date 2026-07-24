# Lifecycle Feedback

A lightweight feedback collection system built for Azure deployment. It supports:
- feedback submitters: create feedback with short and long descriptions plus attachments
- feedback managers: triage, classify feedback, assign ownership, schedule due dates, and track progress
- action owners: update owned actions and action outcomes
- activity history tracking and dashboard metrics

## Run locally
1. Open a terminal in `c:\Scripts\LifecycleFeedback`
2. Run `npm install`
3. Run `npm start`
4. Browse `http://localhost:3000`

## Azure deployment
This app can run in Azure App Service as a Node.js application.
- Set the app's start command to `npm start`
- Configure environment variables if needed
- Use Azure Storage or Azure Files for attachment persistence for production scenarios

## Data storage
- SQLite database stored in `data/feedback.db`
- Attachments stored in `uploads/`

## Notes
- No user authentication is included in this starter app.
- Role-based pages are available via the UI without license or auth requirements.
- For production, add authentication and Azure Blob Storage attachment persistence.
