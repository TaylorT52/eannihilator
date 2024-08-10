const fs = require('fs');

let CLIENT_ID;
let API_KEY;
let OPENAI_KEY;
//TODO: for user update doc id here (can find in url)
const DOC_ID = '1gk3Z5u4EMDQSyQkiE2i4DCDzh8GFnENhkIFY0OtvYB8'; 
const SCOPES = 'https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/script.projects';
const systemPath = "system_prompt.txt";
const systemPrompt = fs.readFileSync(systemPath, 'utf-8');
let tokenClient;
let gapiInited = false;
let gisInited = false;
document.getElementById('auth-button').style.visibility = "hidden";
document.getElementById('signout-button').style.visibility = "hidden";

//loads api key and client id from config
async function loadConfig() {
    try {
        console.log("Loading config");
        const response = await fetch("config.json");
        const config = await response.json();
        CLIENT_ID = config.clientId;
        API_KEY = config.apiKey;
        OPENAI_KEY = config.openAIKey;
        gapiLoaded();
        gisLoaded();
    } catch (err) {
        console.error('Error loading config:', err);
    }
}

function gapiLoaded() {
    gapi.load("client", initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://docs.googleapis.com/$discovery/rest?version=v1', 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        gapiInited = true;
        maybeEnableButtons();
    } catch (err) {
        console.error('Error initializing GAPI client:', err);
    }
}
function gisLoaded() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // define this later
        });
        gisInited = true;
        maybeEnableButtons();
    } catch (err) {
        console.error('Error initializing GIS client:', err);
    }
}

//enables certain buttons if apis load etc.
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById("auth-button").style.visibility = "visible";
    }
}

//authenticates user
function handleAuthClick() {
    console.log("Auth button clicked");
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        document.getElementById('signout-button').style.visibility = "visible";
        document.getElementById('auth-button').innerText = "Refresh";
        await readGoogleDoc();
        await readGoogleDocComments();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({"prompt": "consent"});
    } else {
        tokenClient.requestAccessToken({"prompt": ""});
    }
}

//user signs out
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken(null);
        document.getElementById("content").innerText = "";
        document.getElementById("comments").innerText = "";
        document.getElementById("auth-button").innerText = "Authorize";
        document.getElementById("signout-button").style.visibility = "hidden";
    }
}

//reads google doc content
async function readGoogleDoc() {
    try {
        const response = await gapi.client.docs.documents.get({
            documentId: DOC_ID,
        });
        const content = response.result.body.content;
        let text = "";
        for (const element of content) {
            if (element.paragraph) {
                for (const paragraphElement of element.paragraph.elements) {
                    if (paragraphElement.textRun) {
                        text += paragraphElement.textRun.content;
                    }
                }
            }
        }
        document.getElementById("content").innerText = text;
    } catch (err) {
        document.getElementById("content").innerText = err.message;
        console.error("Error reading the Google Doc:", err);
    }
}

//reads comment content, author, and marks location
async function readGoogleDocComments() {
    try {
        const response = await gapi.client.drive.comments.list({
            fileId: DOC_ID,
            fields: 'comments(author/displayName,content,quotedFileContent)'
        });
        const comments = response.result.comments;
        let commentText = "";
        if (comments && comments.length > 0) {
            comments.forEach(comment => {
                if (comment.author && comment.author.displayName && comment.content) {
                    commentText += `Author: ${comment.author.displayName}\n`;
                    commentText += `Content: ${comment.content}\n`;
                    if (comment.quotedFileContent && comment.quotedFileContent.value) {
                        commentText += `Location: ${comment.quotedFileContent.value}\n`;
                    }
                    commentText += `\n`;
                }
            });
        } else {
            commentText = "No comments found.";
        }
        document.getElementById("comments").innerText = commentText;
    } catch (err) {
        document.getElementById("comments").innerText = err.message;
        console.error("Error reading the comments:", err);
    }
}
// Calling ChatGPT query
async function editEssay(essay) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify({
            messages: [
            {"role": "system", "content": systemPrompt},
            {"role": "user", "content": `Essay:\n\n${essay}`}
          ],
            model: "gpt-4o",
        })
      });
      console.log(response.choices[0]);
      return response.choices[0];
}

// Function to handle the submit button click
async function handleSubmit() {
    console.log("Handling submit");
    // Get the essay input from the textbox
    const essay = document.getElementById('essayInput').value;

    // Call the editEssay function with the user's input
    const response = await editEssay(essay);

    // Display the response in a div
    document.getElementById('response').innerText = response.message;
}

loadConfig();
