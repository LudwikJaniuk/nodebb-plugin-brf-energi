"use strict";

var controllers = require('./lib/controllers');
var User = module.parent.require('./user');
var passport = module.parent.require('passport');
var winston = module.parent.require('winston');
var async = module.parent.require('async');
var nconf = module.parent.require('nconf');
var CustomStrategy = require('passport-custom').Strategy;
var authenticationController = module.parent.require('./controllers/authentication');

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
    if(req.loggedIn){
      res.redirect(nconf.get('relative_path')+ "/");
    } else {
      res.redirect(nconf.get('relative_path') +"/auth/metry");
    }
  });


  winston.info("Set up plugin BRF!")

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

var constants = Object.freeze({
  name: 'dummy',
});

plugin.addStrategy = function(strategies, callback) {
  /*
  passportOAuth = require('passport-oauth')[constants.type === 'oauth' ? 'OAuthStrategy' : 'OAuth2Strategy'];

  if (constants.type === 'oauth') {
    // OAuth options
    opts = constants.oauth;
    opts.callbackURL = nconf.get('url') + '/auth/' + constants.name + '/callback';

    passportOAuth.Strategy.prototype.userProfile = function(token, secret, params, done) {
      this._oauth.get(constants.userRoute, token, secret, function(err, body, res) {
        if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }

        try {
          var json = JSON.parse(body);
          OAuth.parseUserReturn(json, function(err, profile) {
            if (err) return done(err);
            profile.provider = constants.name;

            done(null, profile);
          });
        } catch(e) {
          done(e);
        }
      });
    };
  } else if (constants.type === 'oauth2') {
    // OAuth 2 options
    opts = constants.oauth2;
    opts.callbackURL = nconf.get('url') + '/auth/' + constants.name + '/callback';

    passportOAuth.Strategy.prototype.userProfile = function(accessToken, done) {
      var self = this
      this._oauth2.get(constants.userRoute, accessToken, function(err, body, res) {
        if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }

        try {
          var json = JSON.parse(body);

          if (json.data.is_organization) {
            self._oauth2.get(constants.collaboratorRoute, accessToken, function(err, body, res) {
              if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }

              OAuth.parseUserReturn(JSON.parse(body), function(err, profile) {
                if (err) return done(err);
                profile.provider = constants.name;
                done(null, profile);
              });
            })
          } else {
            OAuth.parseUserReturn(json, function(err, profile) {
              if (err) return done(err);
              profile.provider = constants.name;
              done(null, profile);
            });
          }
        } catch(e) {
          done(e);
        }
      });
    };
  }

  opts.passReqToCallback = true;

  passport.use(constants.name, new passportOAuth(opts, function(req, token, secret, profile, done) {
    OAuth.login({
      oAuthid: profile.id,
      handle: profile.displayName,
      email: profile.emails[0].value,
      isAdmin: profile.isAdmin
    }, function(err, user) {
      if (err) {
        return done(err);
      }

      authenticationController.onSuccessfulLogin(req, user.uid);
      done(null, user);
    });
  }));

  strategies.push({
    name: constants.name,
    url: '/auth/' + constants.name,
    callbackURL: '/auth/' + constants.name + '/callback',
    icon: 'fa-check-square',
    scope: (constants.scope || '').split(',')
  });

  callback(null, strategies);
*/

  // ==========================0000
  passport.use(constants.name, new CustomStrategy(
    function(req, callback) {
      var userslug = req.params.userslug;

      winston.info("tre");
      winston.info(this);
      winston.info(typeof this);
      winston.info(Object.keys(this));

      async.waterfall([
        function(next) {
          User.getUidByUserslug(userslug, next);
        },
        function(uid, next) {
          User.getUsers([uid], null, next);
        },
        function(users, next) {
          if(users.length !== 1) {
            return next("Wrong users length!");
          }

          winston.info(userslug)
          winston.info(users[0])
          next(null, users[0]);
        }
      ], function(err, user) {
        if(err) {
          winston.error(userslug)
          winston.error(err)
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
    callbackURL: '/auth/' + constants.name + '/callback',
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

