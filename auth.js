const simpleOauthModule = require("simple-oauth2");
const randomstring = require("randomstring");
const Secrets = require("./lib/secrets");

const secrets = new Secrets({
  GIT_HOSTNAME: "https://github.com",
  OAUTH_TOKEN_PATH: "/login/oauth/access_token",
  OAUTH_AUTHORIZE_PATH: "/login/oauth/authorize",
  OAUTH_CLIENT_ID: "**REMOVED**",
  OAUTH_CLIENT_SECRET: "**REMOVED**",
  REDIRECT_URL: "http://localhost:3000/callback",
  OAUTH_SCOPES: "repo,user",
});

function getScript(mess, content) {
  return `<html><body><script>
  (function() {
    function receiveMessage(e) {
      console.log("receiveMessage %o", e)
      window.opener.postMessage(
        'authorization:github:${mess}:${JSON.stringify(content)}',
        e.origin
      )
      window.removeEventListener("message",receiveMessage,false);
    }
    window.addEventListener("message", receiveMessage, false)
    console.log("Sending message: %o", "github")
    window.opener.postMessage("authorizing:github", "*")
    })()
  </script></body></html>`;
}

module.exports.auth = async () => {
  await secrets.init();
  const oauth2 = simpleOauthModule.create({
    client: {
      id: secrets.OAUTH_CLIENT_ID,
      secret: secrets.OAUTH_CLIENT_SECRET,
    },
    auth: {
      tokenHost: secrets.GIT_HOSTNAME,
      tokenPath: secrets.OAUTH_TOKEN_PATH,
      authorizePath: secrets.OAUTH_AUTHORIZE_PATH,
    }
  });
  // Authorization uri definition
  const authorizationUri = oauth2.authorizationCode.authorizeURL({
    redirect_uri: secrets.REDIRECT_URL,
    scope: secrets.OAUTH_SCOPES,
    state: randomstring.generate(32),
  });
  return {
    statusCode: 302,
    headers: {
      Location: authorizationUri,
    }
  };
};
module.exports.callback = (e, ctx, cb) => {
  let oauth2;
  secrets
    .init()
    .then(() => {
      oauth2 = simpleOauthModule.create({
        client: {
          id: secrets.OAUTH_CLIENT_ID,
          secret: secrets.OAUTH_CLIENT_SECRET,
        },
        auth: {
          tokenHost: secrets.GIT_HOSTNAME,
          tokenPath: secrets.OAUTH_TOKEN_PATH,
          authorizePath: secrets.OAUTH_AUTHORIZE_PATH,
        },
      });

      const options = {
        code: e.queryStringParameters.code,
      };
      return oauth2.authorizationCode.getToken(options);
    })
    .then(result => {
      const token = oauth2.accessToken.create(result);
      cb(null, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html",
        },
        body: getScript("success", {
          token: token.token.access_token,
          provider: "github",
        }),
      });
    })
    .catch(err => {
      cb(null, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html",
        },
        body: getScript("error", err),
      });
    });
};

module.exports.success = (e, ctx, cb) =>
  cb(null, {
    statusCode: 204,
    body: "",
  });

module.exports.default = (e, ctx, cb) => {
  cb(null, {
    statusCode: 302,
    headers: {
      Location: "/auth",
    },
  });
};
