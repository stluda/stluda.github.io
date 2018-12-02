require(['gitbook', 'jQuery'], function(gitbook, $) {
  var init = function () {
	  $("ul.articles").each(function(i,ul){
		  if($(ul).parent("span").length>0){
			  var $newParent = $(ul).parent().parent();
			  $(ul).remove().appendTo($newParent);
		  }
	  });
	  $(".chapter").each(function(i,chapter){
		  if(hasChildren(chapter)){
			  $(chapter).children("span,a")
				  .after($('<span class="nav-toggle material-icons"></span>')
				  .click(function(){
				  if($(this).hasClass("nav-toggle-collapsed")){
					  expand($(this).parent());
				  }
				  else{
					  collapse($(this).parent());
				  }
			  }));
		  }
	  });
	  var $collapsedChapters = lsItem();
	  if($collapsedChapters.length>0){
		  collapse($collapsedChapters);
	  }
	  else{
		  collapse(".chapter");
	  }
	  var activeChapter = $(".chapter.active");
	  expand(activeChapter,false);
	  expand(activeChapter.parents(".chapter"),false);

  } 
  var shouldExpand = function(chapter){
	  return $(chapter).find("li.active").length>0;
  }
  var hasChildren= function(chapter){
	  return $(chapter).children("ul.articles").length>0;
  }
  var collapse = function(chapter,flag){
	  if(flag===undefined) flag=true;
	  $(chapter).children(".nav-toggle").addClass("nav-toggle-collapsed");
	  $(chapter).children("ul").css("display","none");
	  if(flag)lsItem($(chapter));
  }

  var expand = function(chapter,flag){
	  if(flag===undefined) flag=true;
	  $(chapter).children(".nav-toggle").removeClass("nav-toggle-collapsed");
	  $(chapter).children("ul").css("display","block");
	  if(flag)lsItem($(chapter));
  }

  var lsItem = function () {
    var map = JSON.parse(localStorage.getItem("chapters")) || {}
    if (arguments.length) {
      var $chapters = arguments[0];
      $chapters.each(function (index, element) {
        var level = $(this).data('level');
        var value = $(this).children(".nav-toggle").hasClass("nav-toggle-collapsed");
        map[level] = value;
      })
      localStorage.setItem("chapters", JSON.stringify(map));
    } else {
      return $(".chapter").map(function(index, element){
        if (map[$(this).data('level')]) {
          return this;
        }
      })
    }
  }

  gitbook.events.bind('start', function() {
    //init()
  }); 
  gitbook.events.bind('page.change', function() {
    init()
  }); 
});