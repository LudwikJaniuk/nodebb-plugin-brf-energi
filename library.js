"use strict";

var controllers = require('./lib/controllers');
var User = module.parent.require('./user');
var passport = module.parent.require('passport');
var winston = module.parent.require('winston');
var async = module.parent.require('async');
var nconf = module.parent.require('nconf');
var metry = module.parent.require('nodebb-plugin-sso-metry');
var CustomStrategy = require('passport-custom').Strategy;
var encryptor = require('simple-encryptor')(process.env.URL_ENCRYPTION_KEY);
var authenticationController = module.parent.require('./controllers/authentication');

var jwt = require("jsonwebtoken");

var plugin = {};

plugin.preinit = function(params, callback) {
  winston.info("Plugin happens");
  var app = params.app;
  app.get('/test', function(req, res, next) {
    winston.info("Request happens");
    res.send(505);
  });

  callback();
}

plugin.init = function(params, callback) {
  var app = params.app;
  var router = params.router;
  var hostMiddleware = params.middleware;
  var hostControllers = params.controllers;

  // We create two routes for every view. One API call, and the actual route itself.
  // Just add the buildHeader middleware to your route and NodeBB will take care of everything for you.

  router.get('/admin/plugins/brf-energi', hostMiddleware.admin.buildHeader, controllers.renderAdminPage);
  router.get('/api/admin/plugins/brf-energi', controllers.renderAdminPage);

  router.get('/authmetryifneeded', function(req, res, next) {


    var tok = req.query.brfauth;
    console.log(tok)
    var secret = nconf.get('BRFENERGI_SESSION_SECRET')
    console.log("Secret: " + secret)
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

  winston.info("Set up plugin BRF!")

  callback();
};

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

var constants = Object.freeze({
  name: 'dummy',
});

plugin.addStrategy = function(strategies, callback) {
  passport.use(constants.name, new CustomStrategy(
    function(req, callback) {
      var userslug = req.params.userslug;
      var profileToken = req.query.brfauth;

      winston.info("tre");
      winston.info(profileToken);

      async.waterfall([
        function (next) {
          var secret = nconf.get('BRFENERGI_SESSION_SECRET')
          jwt.verify(profileToken, secret, next);
        },
        function(profileContainer, next) {
          winston.info("got th");
          winston.info(profileContainer);

          if(!profileContainer.msg) return next(new Error("No encrypted message in JWT"));

          var profile = encryptor.decrypt(profileContainer.msg)

          if(!profile) return next(new Error("Encrypted profile could not be decoded"));
          if(!profile.metryID) return next(new Error("No metryID provided in JWT from BRF."));
          if(!profile.name) return next(new Error("No name provided in JWT from BRF."));
          if(!profile.email) return next(new Error("No email provided in JWT from BRF."));

          var metryLoginPayload = { // intentionally skipping isAdmin - admin on BRF does not mean admin on forum.
            oAuthid: profile.metryID,
            handle: profile.name,
            email: profile.email,
          }
          metry.login(metryLoginPayload, next)
        },
        function(uidObj, next) {
          var uid = uidObj.uid;
          console.log("uid:")
          console.log(uid)
          User.getUsers([uid], null, next);
        },
        function(users, next) {
          if(users.length !== 1) {
            return next("Wrong users length!");
          }

          winston.info("User")
          winston.info(users[0])
          next(null, users[0]);
        }
      ], function(err, user) {
        if(err) {
          winston.error(userslug)
          winston.error(err)
          callback(err, user)
          return
        }

        authenticationController.onSuccessfulLogin(req, user.uid);
        callback(err, user)
      })
    }
  ));
  winston.info("A");

  strategies.push({
    name: constants.name,
    url: '/auth/' + constants.name + '/:userslug',
    callbackURL: '/auth/' + constants.name + '/callback/:userslug',
    icon: 'fa-check-square',
    scope: 'basic'
  });
  winston.info("B");

  return callback(null, strategies);
};

module.exports = plugin;


//	{ "hook": "static:app.preload", "method": "preinit" },
//	{ "hook": "filter:admin.header.build", "method": "addAdminNavigation" },
// 	{ "hook": "action:middleware.authenticate", "method": "auth" },
//	{ "hook": "filter:auth.init", "method": "addStrategy" }

