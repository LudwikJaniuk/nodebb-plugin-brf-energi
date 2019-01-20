"use strict";

var User = module.parent.require('./user');
var Groups = module.parent.require('./groups');
var Configs = module.parent.require('./configs');
var passport = module.parent.require('passport');
var winston = module.parent.require('winston');
var async = module.parent.require('async');
var nconf = module.parent.require('nconf');
var metry = module.parent.require('nodebb-plugin-sso-metry');
var CustomStrategy = require('passport-custom').Strategy;
var encryptor = require('simple-encryptor')(nconf.get('URL_ENCRYPTION_KEY'));
var authenticationController = module.parent.require('./controllers/authentication');
var jwt = require("jsonwebtoken");

var controllers = require('./lib/controllers');

var plugin = {};

plugin.preinit = function(params, callback) {
  winston.info("Plugin happens");
  var app = params.app;
  app.get('/test', function(req, res, next) {
    winston.info("Request happens");
    res.send(505);
  });

  callback();
};

// This plugin defines a login strategy, but it's a background thing, we don't want users to actually see it.
function overrideAuthStrategyGetter() {
	var authLib = module.parent.require('./routes/authentication');
	var origFunction = authLib.getLoginStrategies;
	authLib.getLoginStrategies = function() {
		return origFunction().filter(strategy => strategy.name != constants.name);
	}
}

plugin.init = function(params, callback) {
  var app = params.app;
  var router = params.router;
  var hostMiddleware = params.middleware;
  var hostControllers = params.controllers;

  overrideAuthStrategyGetter();
  // We create two routes for every view. One API call, and the actual route itself.
  // Just add the buildHeader middleware to your route and NodeBB will take care of everything for you.

  router.get('/admin/plugins/brf-energi', hostMiddleware.admin.buildHeader, controllers.renderAdminPage);
  router.get('/api/admin/plugins/brf-energi', controllers.renderAdminPage);
  router.get('/api/whoami', passport.authenticate("brf"), function(req, res, next) {
  	if(req.user) {
  		console.log(req.user)
  		res.send({username: req.user.username, uid: req.user.uid});
		} else {
  		res.sendStatus(403);
		}
	})

  router.get('/authmetryifneeded', function(req, res, next) {
    var tok = req.query.brfauth;
    console.log(tok)
    var secret = nconf.get('BRFENERGI_SESSION_SECRET')
    try{
      var obj = jwt.verify(tok, secret);
      console.log(obj);
    } catch(e) {
      console.log("No valid jwt");
    }


    if(req.loggedIn){
      res.redirect("/");
    } else {
      res.redirect("/auth/metry");
    }
  });

  // Automatically setting right config options so forum works well basically
	Configs.set("powered-by", "ballmer-peak", (err) => {
    if(err) winston.error(err);
		else winston.info("set powered-by");
  });

	Configs.set("access-control-allow-origin-regex", ".*", (err) => {
		if(err) winston.error(err);
		else winston.info("set origin regex");
	});

	Configs.set("access-control-allow-headers", "Content-Type,User-Agent,brfauth,Cache-Control", (err) => {
		if(err) winston.error(err);
		else winston.info("set allowheaders");
	});

	Groups.join('cid:' + 0 + ':privileges:' + 'groups:local:login', 'registered-users', () => {
		if(err) winston.error(err);
		else winston.info("Successfully joined group for privileges");
	});

  winston.info("Set up plugin BRF!");

  callback();
};

plugin.authByBrf = function({req, res, next}) {
  console.log("Auht by brf!")
  passport.authenticate("brf", {failureRedirect: nconf.get('url') + '/login'})(req, res, next)
}

plugin.auth = function({req, res, next}) {
  console.log("WHAT")
  winston.info("User is not authed!");
  next();
}

plugin.addAdminNavigation = function(header, callback) {
  header.plugins.push({
    route: '/plugins/brf-energi',
    icon: 'fa-tint',
    name: 'brf-energi'
  });

  callback(null, header);
};

function loginUserByBrf(req, callback) {
  var fail = (msg) => {winston.error(msg); return callback(null, null);};
  var profileToken = req.query.brfauth || req.body.brfauth || req.headers.brfauth;
  if(!profileToken) return fail('No JWT provided for brf authentication');

  async.waterfall([
    function (next) {
      var secret = nconf.get('BRFENERGI_SESSION_SECRET');
      jwt.verify(profileToken, secret, next);
    },
    function(profileContainer, next) {
      if(!profileContainer.msg) return fail("No encrypted message in JWT");

      var profile = encryptor.decrypt(profileContainer.msg);

      if(!profile) return fail("Profile could not be decrypted from message.");
      if(!profile.metryID) return fail("No metryID provided in JWT from BRF.");
      if(!profile.name) return fail("No name provided in JWT from BRF.");
      if(!profile.email) return fail("No email provided in JWT from BRF.");

      var metryLoginPayload = { // intentionally skipping isAdmin - admin on BRF does not mean admin on forum.
        oAuthid: profile.metryID,
        handle: profile.name,
        email: profile.email,
      };
      metry.login(metryLoginPayload, next)
    },
    function(uidObj, next) {
      var uid = uidObj.uid;
      User.getUsers([uid], null, next);
    },
    function(users, next) {
      if(users.length !== 1) {
        return next("Wrong users length!");
      }

      next(null, users[0]);
    }
  ], function(err, user) {
    if(err) {
      winston.error(err);
      callback(err, user);
      return
    }

		// Need to do this manually because nodebb is stupid. Replicating /src/routes/authentication line 28
		req.uid = user.uid
		req.loggedIn = true
    authenticationController.onSuccessfulLogin(req, user.uid);
    callback(err, user)
  })
}

/**
 * We add a strategy that exists on the callback endpoint visible later
 * Makes it possible to authorize with one URL, no redirects/interstitals/callbacks.
 * @param brfauth (URL parameter) makes a claim that a certain user is logged in at BRF, and should
 * therefore be granted access to nodebb. If the claim is valid, we auth the user (if already has account,
 * log in, otherwise create profile from information in the param.
 * Structure:
 * brfauth is a JWT signed with BRFENERGI_SESSION_SECRET on form:
 * {
 *   msg: PROFILE,
 *   [iat,]
 *   [exp,]
 *   [...]
 * }
 * The signing makes sure only BRFEenergi could have made the claim, since only it has access to the shared secret.
 * PROFILE must be an encrypted string.
 * PROFILE must be decryptable by simple-encryptor with the key URL_ENCRYPTION_KEY. It should decrypt to a JSON object
 * of structure:
 * {
 *   metryID,
 *   name,
 *   email
 * }
 * These things are necessary for creating a new profile if needed. Encryption is done because all this data lies in
 * the URL which might be logged basically anywhere, and email is sensitive data.
 */
var constants = Object.freeze({
  name: 'brf',
});
plugin.addStrategy = function(strategies, callback) {
  passport.use(constants.name, new CustomStrategy(loginUserByBrf));

  strategies.push({
    name: constants.name,
    // url: '',
    callbackURL: '/auth/' + constants.name ,
    icon: 'fa-check-square',
    scope: 'basic'
  });

  return callback(null, strategies);
};

module.exports = plugin;

//	{ "hook": "static:app.preload", "method": "preinit" },
//	{ "hook": "filter:admin.header.build", "method": "addAdminNavigation" },
// 	{ "hook": "action:middleware.authenticate", "method": "auth" },

