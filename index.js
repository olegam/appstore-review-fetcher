var express = require('express');
var app = express();
var spider = require('rssspider');
var step = require('step');

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

// http://itunes.apple.com/dk/rss/customerreviews/id=671759668/sortBy=mostRecent/xml

// reviews?apps=123,345&countries=dk

app.get('/reviews', function(request, response) {
	var apps = (request.query.apps || '671759668').split(',');
	var countries = (request.query.countries || 'dk').split(',');
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
					var spider_promise = spider.fetchRss(url, ['title', 'im:rating', 'date', 'description', 'author', 'im:version', 'im:votecount', 'im:votesum']);
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

						all_reviews.push(reviews);
//						console.log(reviews);
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
			console.log('Returning results...', all_reviews.length, apps, countries);
			response.send({reviews: all_reviews});
		}
	);





});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});