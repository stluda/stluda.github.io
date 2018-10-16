require(['gitbook', 'jQuery'], function(gitbook, $) {
  gitbook.events.bind('page.change', function() {
	  $('.book').removeClass('is-loading');
  }); 
});