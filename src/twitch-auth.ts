const loginButton = document.getElementById("twitch-login")!;

loginButton.onclick = Twitch.ext.actions.requestIdShare;
