# BRF Energi plugin

Specialized plugin for BRF Energi forum, supposed to make everything run right the way we want it.

# API extensions

## `/admin/plugins/brf-energi`

Not really API, but shows admin interface and some options. Probably pretty ugly and full of test options

## `/api/whoami`

Performs BRF authentication, and if successful returns the userid

## `/authmetryifneeded`

Redirects to `/auth/metry` if you're not logged in yet, otherwise just goes to homepage
(For `/auth/metry`, see sso-metry plugin).

## `/brftouch` (Mirror a brfapp user, create if needed)

Wants an already-authenticated BRF token, and if it checks out it either authenticates the corresponding user or creates a new one in case it doesn't exist on the forum yet. 
Used for the linking between forum and main website.

## `/api/brfauth/uid` (Get user's uid and matryid)

Authenticates by username and password like normal, returns uid and metryid if exists.

## `POST brfenergi.se/forum/api/v2/users/` (Register a new user)

Register a new user thru nodebb. This is a nodebb-official endpoint, but I include some docs on it here because it's useful, while risking that it becomes outdated.

Body:
```
token=(Token)

(Token) :=

{

  "username": "JohnDoe",

  "email": "johndoe001@example.com",

  "password": "djd982j3dj8ffa2ca02",

  "_uid": "1" // Admin, dont change.

}
```

Token shall be signed with the key that is set in the plugin settings.

See: https://jwt.io/#debugger-io?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkpvaG5Eb2UzIiwiZW1haWwiOiJqb2huZG9lMDAzQGV4YW1wbGUuY29tIiwicGFzc3dvcmQiOiJkamQ5ODJqM2RqOGZmYTJjYTAyIiwiX3VpZCI6IjEifQ.Y6NEq1e3mPClB3X6aNuWIS-BaEasDPe63MVfnQAnPBc

Good response:

`{"code":"ok","payload":{"uid":33}}`

Bad responses:

`{"code":"internal-server-error","message":"email-taken","params":{}}`

`{"code":"params-missing","message":"Required parameters were missing from this API call, please see the \"params\" property","params":["_uid"]}`



# (Rest is NodeBB defualt stuff) brf-energi Plugin for NodeBB

A starter kit for quickly creating NodeBB plugins. Comes with a pre-setup LESS file, server side JS script with an `action:app.load` hook, and a client-side script. Most plugins need at least one of the above, so this ought to save you some time. For a full list of hooks have a look at our [wiki page](https://github.com/NodeBB/NodeBB/wiki/Hooks), and for more information about creating plugins please visit our [documentation portal](https://docs.nodebb.org/).

Fork this or copy it, and using your favourite text editor find and replace all instances of `nodebb-plugin-brf-energi` with `nodebb-plugin-your-plugins-name`. Change the author's name in the LICENSE and package.json files.

Once you're done don't forget to publish it on NPM, and make a thread about it [here](https://docs.nodebb.org/en/latest/plugins/hooks.html).


## Hello World

Really simple, just edit `static/lib/main.js` and paste in `console.log('hello world');`, and that's it!

## Installation

    npm install nodebb-plugin-brf-energi

## Screenshots

Don't forget to add screenshots!
