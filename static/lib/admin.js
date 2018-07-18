'use strict';
/* globals $, app, socket */

define('admin/plugins/brf-energi', ['settings'], function(Settings) {

	var ACP = {};

	ACP.init = function() {
		Settings.load('brf-energi', $('.brf-energi-settings'));

		$('#save').on('click', function() {
			Settings.save('brf-energi', $('.brf-energi-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'brf-energi-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return ACP;
});