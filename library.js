"use strict";

var controllers = require('./lib/controllers');
var User = module.parent.require('./user');
var passport = module.parent.require('passport');
var winston = module.parent.require('winston');
var async = module.parent.require('async');
var nconf = module.parent.require('nconf');
var metry = module.parent.require('nodebb-plugin-sso-metry');
var authenticationController = module.parent.require('./controllers/authentication');

var CustomStrategy = require('passport-custom').Strategy;
var encryptor = require('simple-encryptor')(nconf.get('URL_ENCRYPTION_KEY'));
var jwt = require("jsonwebtoken");

var plugin = {};

plugin.init = function(params, callback) {
  var app = params.app;
  var router = params.router;
  var hostMiddleware = params.middleware;
  var hostControllers = params.controllers;

  router.get('/admin/plugins/brf-energi', hostMiddleware.admin.buildHeader, controllers.renderAdminPage);
  router.get('/api/admin/plugins/brf-energi', controllers.renderAdminPage);

  router.get('/authmetryifneeded', function(req, res, next) {
    var baseUrl = nconf.get('url');
    if(req.loggedIn){
      res.redirect(baseUrl);
    } else {
      res.redirect(baseUrl + '/auth/metry');
    }
  });
  callback();
};

plugin.addAdminNavigation = function(header, callback) {
  header.plugins.push({
    route: '/plugins/brf-energi',
    icon: 'fa-tint',
    name: 'brf-energi'
  });

  callback(null, header);
};

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

function createCustomStrategy() {
  return new CustomStrategy(function(req, callback) {
    var profileToken = req.query.brfauth;

    async.waterfall([
      function (next) {
        jwt.verify(profileToken, nconf.get('BRFENERGI_SESSION_SECRET'), next);
      },
      function(profileContainer, next) {
        if(!profileContainer.msg) return next(new Error("No encrypted message in JWT"));

        var profile = encryptor.decrypt(profileContainer.msg);

        if(!profile) return next(new Error("Encrypted profile could not be decoded"));
        if(!profile.metryID) return next(new Error("No metryID provided in JWT from BRF."));
        if(!profile.name) return next(new Error("No name provided in JWT from BRF."));
        if(!profile.email) return next(new Error("No email provided in JWT from BRF."));

        var metryLoginInfo = {
          oAuthid: profile.metryID,
          handle: profile.name,
          email: profile.email,
          // intentionally skipping isAdmin - admin on BRF does not mean admin on forum.
        };
        metry.login(metryLoginInfo, next)
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
        return callback(err, user);
      }

      authenticationController.onSuccessfulLogin(req, user.uid); // Is ths necessary? Does metry do this?
      callback(err, user)
    })
  });
}

plugin.addStrategy = function(strategies, callback) {
  passport.use(constants.name, createCustomStrategy());

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
//	{ "hook": "filter:auth.init", "method": "addStrategy" }

