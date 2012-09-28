(function(){
	var config = {},
		express = require('express'),
		fs = require('fs'),
		eyes = require('eyes'),
		xml2js = require('xml2js'),
		OAuth = require('oauth').OAuth,
		querystring = require('querystring');
	
	function getConfig() {
		return config;
	}
	
	function init(args) {
		config = {
			key : args.key || '--',
			secret : args.secret || '--',
			requestTokenUrl : args.requestTokenUrl || 'https://api.login.yahoo.com/oauth/v2/get_request_token',
			sharedTokenUrl : args.sharedTokenUrl || 'https://api.login.yahoo.com/oauth/v2/get_token',
			requestAuthUrl : args.requestAuthUrl || 'https://api.login.yahoo.com/oauth/v2/request_auth',
			callbackUrl : args.callbackUrl || 'http://localhost:3000/yahoo_cb',
			encryption : args.encryption || 'HMAC-SHA1', 
			leagueId : args.leagueId || '138222',
			queryUrl : args.queryUrl || 'http://fantasysports.yahooapis.com/fantasy/v2/league/nfl.l.138222/standings'
		};
		
		app.listen(3000);
		console.log("listening on http://localhost:3000");
		
		return this;
	}
	
	// Setup the Express.js server
	var app = express.createServer();
	//app.use(dojo());
	app.use(express.logger());
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({
		secret: "--"
	}));
	
	// Home Page
	app.get('/', function(req, res){
		if(!req.session.oauth_access_token) {
			res.redirect("/yahoo_login");
		}
		else {
			res.redirect("/yahoo_response");
		}
	});
	
	// Request an OAuth Request Token, and redirects the user to authorize it
	app.get('/yahoo_login', function(req, res) {
		var oa = new OAuth(getConfig().requestTokenUrl,
				getConfig().sharedTokenUrl,
				getConfig().key,
				getConfig().secret,
				"1.0",
				getConfig().callbackUrl + (req.param('action') && req.param('action') != "" ? "?action="+querystring.escape(req.param('action')) : "" ),
				getConfig().encryption);
	
		oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
		  if(error) {
				console.log('error');
		 		console.log(error);
			} else {
				// store the tokens in the session
				req.session.oa = oa;
				req.session.oauth_token = oauth_token;
				req.session.oauth_token_secret = oauth_token_secret;
			
				// redirect the user to authorize the token
				res.redirect(getConfig().requestAuthUrl + '?oauth_token=' + oauth_token);
			}
		})
	
	});
	
	// Callback for the authorization page
	app.get('/yahoo_cb', function(req, res) {
		// get the OAuth access token with the 'oauth_verifier' that we received
		var oa = new OAuth(req.session.oa._requestUrl,
				req.session.oa._accessUrl,
				req.session.oa._consumerKey,
				req.session.oa._consumerSecret,
				req.session.oa._version,
				req.session.oa._authorize_callback,
				req.session.oa._signatureMethod);
		
	    console.log(oa);
		
		oa.getOAuthAccessToken(
			req.session.oauth_token, 
			req.session.oauth_token_secret, 
			req.param('oauth_verifier'), 
			function(error, oauth_access_token, oauth_access_token_secret, results2) {
				
				if(error) {
					console.log('error');
					console.log(error);
		 		} else {
					// store the access token in the session
					req.session.oauth_access_token = oauth_access_token;
					req.session.oauth_access_token_secret = oauth_access_token_secret;
					
					res.redirect((req.param('action') && req.param('action') != "") ? req.param('action') : "/yahoo_response");
		 		}
	
		});
		
	});
	
	
	function require_yahoo_login(req, res, next) {
		if(!req.session.oauth_access_token) {
			res.redirect("/yahoo_login?action="+querystring.escape(req.originalUrl));
			return;
		}
		next();
	};
	
	app.get('/yahoo_response', require_yahoo_login, function(req, res) {
		var oa = new OAuth(req.session.oa._requestUrl,
				req.session.oa._accessUrl,
				req.session.oa._consumerKey,
				req.session.oa._consumerSecret,
				req.session.oa._version,
				req.session.oa._authorize_callback,
				req.session.oa._signatureMethod);
		
	    console.log(oa);
	
		oa.getProtectedResource(
			getConfig().queryUrl,
			"GET", 
			req.session.oauth_access_token, 
			req.session.oauth_access_token_secret,
			function (error, data, response) {
				var parser = new xml2js.Parser();
	
				console.log(data);
	
				res.render('ff_league.ejs', {
					locals: { feed: data }
				});
	
				parser.addListener('end', function(result) {
					console.dir(result);
					console.log('Done.');
				});
	
				config.results = parser.parseString(data);
		});
		
	});
	
	return {
		init : init
	}
}());