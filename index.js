var express = require('express');
var app = express();
var spider = require('rssspider');
var step = require('step');
var RSS = require('rss');

app.set('port', (process.env.PORT || 5000));

// http://itunes.apple.com/dk/rss/customerreviews/id=671759668/sortBy=mostRecent/xml

// reviews?apps=123,345&countries=dk

app.get('/reviews', function(request, response) {
	var apps = (request.query.apps || '671759668').split(',');
	var countries = (request.query.countries || 'dk').split(',');
	var format = request.query.format || 'json';
	console.log('apps:', apps, 'countries:', countries);

	var all_reviews = [];

	step(
		function() {
			var group = this.group();
			apps.forEach(function (app_id) {
				countries.forEach(function (country) {
					var url = 'http://itunes.apple.com/' + country + '/rss/customerreviews/id=' + app_id + '/sortBy=mostRecent/xml';
					var that = group();
					console.log('Requesting', url);
					var rss_fields = ['title', 'im:rating', 'date', 'description', 'author', 'im:version', 'im:votecount', 'im:votesum', 'guid'];
					var spider_promise = spider.fetchRss(url, rss_fields);
					spider_promise.error(function (err) {
						console.log('iTunes request error:', err);
						that(err, null);
					});
					spider_promise.then(function(reviews){
						if (reviews.length == 0) {
							that(null, null);
							return;
						}
						var name = reviews[0].title;
						reviews = reviews.splice(1); // the first post is a dummy one we'll skip
						reviews = reviews.map(function (review) {
							review.app_name = name;
							review.app_id = app_id;
							review.country = country;

							review.rating = parseInt((review['im:rating'] || {'#' : '-1'})['#']);
							delete review['im:rating'];

							review.version = (review['im:version'] || {'#' : '-1'})['#'];
							delete review['im:version'];

							review.vote_count = parseInt((review['im:votecount'] || {'#' : '-1'})['#']);
							delete review['im:votecount'];

							review.vote_sum = parseInt((review['im:votesum'] || {'#' : '-1'})['#']);
							delete review['im:votesum'];

							return review;
						});

						console.log(JSON.stringify(reviews))
						all_reviews = all_reviews.concat(reviews);
						that(null, null);
					});
				});
			});
		},
		function returnResults(err, dummy) {
			if (err) {
				console.log('Failed with parameters:', apps, countries);
				response.send({error: err.toString()}, 500);
				return;
			}
			console.log('Returning results...', format, all_reviews.length, apps, countries);
			if (format === 'rss') {
				var feed = new RSS({title: 'App Store Reviews', feed_url: '', site_url: ''});
				all_reviews.forEach(function (item) {

					var stars =  '';
					for (var i=0; i< item.rating; i++) {
						stars = stars + '⭐️';
					}
					var rss_item = {
						title: stars + ' ' + item.app_name + 'review by ' + item.author + ': ' + item.title,
						description: item.description + ' [' + item.country + ']',
						url: '',
						guid: item.guid
					};
					console.log('Adding', JSON.stringify(rss_item), JSON.stringify(item));
					feed.item(rss_item);
				});
				var xml = feed.xml({indent: true});
				response.send(xml);

			} else {
				response.send({reviews: all_reviews});
			}
		}
	);
});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});