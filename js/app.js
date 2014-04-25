(function(){
	'use strict';

	var states = {
		zoom: 'page',
		currentPage: '1',
		currentHotspot: 'none',
		lastHotspot: '',
		transitionDuration: '350ms'
	}

	var helpers = {
		setTransitionCss: function(property, value, transitionDuration){
			var css = {}, duration = 0;
			css[property] = value;
			css = helpers.addDuration(css, transitionDuration);
			return css;
		},
		addDuration: function(cssObj, transitionDuration){
			var duration = transitionDuration ? states.transitionDuration : 0
			_.extend(cssObj, {'transition-duration': duration});
			return cssObj;
		},
		// vendorPrefix: function(property, value, obj){
		// 	var pfxs = ['webkit', 'moz', 'ms', 'o'];
		// 	obj = obj || {};
		// 	for (var i = 0; i < pfxs.length; i++){
		// 		obj['-' + pfxs[i] + '-' + property] = value
		// 	}
		// 	return obj;
		// },
		saveCurrentStates: function(page, hotspot){
			states.currentPage = page;
			states.currentHotspot = hotspot;
			// Maybe save last hotspot here
		},
		hashToPageHotspotDict: function(hash){
			// If for some reason it has a slash as the last character, cut it so as to not mess up the split
			// if (hash.charAt(hash.length - 1) == '/') hash = hash.substring(0, hash.length -1);
			hash = hash.replace('#', '').split('/'); // `#1/3` -> ["1", "3"]
			hash = _.map(hash, function(val) { return Number(val)}); // Convert to number  ["1", "3"] -> [1, 3]
			
			return { page: hash[0], hotspot: hash[1] }
		},
		getNavDirection: function(e, code){
			if (code == 37 || code == 38 || code == 39 || code == 40 || code == 'swipeleft' || code == 'swiperight' || code == 'pinch'){
				// Don't do the default behavior if it's an arrow, swipe or pinch
				e.preventDefault();
				e.stopPropagation();
			}
			// Do this
			// Left arrow
			if (code == 37 || code == 'swiperight') return 'prev-hotspot';
			// Right arrow
			if (code == 39 || code == 'swipeleft') return 'next-hotspot';
			// Esc, up, down arrows
			if (code == 27 || code == 38 || code == 40 || code == 'pinch') return 'page-view';
		}	
	}

	var templates = {
		pageFactory: _.template( $('#page-template').html() ),
		hotspotFactory: _.template( $('#hotspot-template').html() )
	}

	var layout = {
		bakeMasks: function(){
			$('#pages').append('<div class="mask" id="top-mask"></div>').append('<div class="mask" id="bottom-mask"></div>');
		},
		bakePages: function(pages){
			var page_markup, $page;
			for (var i = 0; i < pages.length; i++){
				page_markup = templates.pageFactory(pages[i]);
				$('#pages').append(page_markup);
				$page = $('#page-'+pages[i].number);

				layout.measurePage( $page ); // For zooming, we need to know the absolute location of each hotspot so we can know how to get to it
				listeners.hotspotClicks( $page );
				listeners.pageTransitions();
			}
			routing.initRoute();
		},
		measureHotspots: function($page){
		 $page.find('.hotspot').each(function(index, hs){
				var $hs = $(hs);
				$hs.attr('data-top', $hs.offset().top );
				$hs.attr('data-left', $hs.offset().left );
				$hs.attr('data-width', $hs.width() );
				$hs.attr('data-height', $hs.height() );
			});
		},
		measureImgSetPageHeight: function($page){
			var img_height = $page.find('img').height();
			$('#pages').css('height', img_height+'px');
		},
		measurePage: function ($page){
			layout.measureImgSetPageHeight($page);
			layout.measureHotspots($page);
		},
		update: function(){
			// Do this on window resize
			var current_page = 1;
			var $page = $('#page-'+current_page);
			// Scale the page back down to 1x1, ($page, masksAlso, transitionDuration)
			zooming.toPage($page, true, false);
			// Measure the page at those dimensions
			layout.measurePage( $page );
			// Get what page and hotspot we're on
			var page_hotspot = helpers.hashToPageHotspotDict(window.location.hash);
			// And initiate zooming to that hotspot
			routing.read(page_hotspot.page, page_hotspot.hotspot, false);
		}
	}

	var listeners = {
		resize: function(){
			layout.updateDebounce = _.debounce(layout.update, 300);
			// TODO Does this trigger on different mobile device orientation changes?
			window.addEventListener('resize', function(){
				layout.updateDebounce();
			})
		},
		hotspotClicks: function($page){
			$page.on('click', '.hotspot', function() {
				routing.set.fromHotspotClick( $(this) );
			});
		},
		keyboardAndGestures: function(){
			$('body').keydown(function(e){
				var direction = helpers.getNavDirection(e, e.keyCode);
				routing.set.fromKeyboardOrGesture(direction);
			});

			$(document).on('swipeleft', function(e){
				var direction = helpers.getNavDirection(e, 'swipeleft');
				routing.set.fromKeyboardOrGesture(direction);
			});

			$(document).on('swiperight', function(e){
				var direction = helpers.getNavDirection(e, 'swiperight');
				routing.set.fromKeyboardOrGesture(direction);
			});
		},
		pageTransitions: function(){
			$(".page").on('animationend webkitAnimationEnd oAnimationEnd MSAnimationEnd', function(){

				$('.page').removeClass('enter-from-left')
									.removeClass('enter-from-right')
									.removeClass('exit-to-left')
									.removeClass('exit-to-right');

				$('.page').each(function(index, el){
					zooming.toPage( $(el) );
				})
			});
		}
	}

	var paging = {
		nextPage: function(){

		},
		prevPage: function(){

		},
		goToPage: function(){

		}
	}

	var routing = {
		initRoute: function(){
			routing.Router = Backbone.Router.extend({
				routes: {
					":page(/)": "page", // Take me to a page
					":page/:hotspot": 'hotspot' // Take me to a specific hotspot
				}
			});

			routing.router = new routing.Router;

			routing.router.on('route:page', function(page) {
				routing.read(page, null, true);
			});
			routing.router.on('route:hotspot', function(page, hotspot) {
				routing.read(page, hotspot, true);
			});
				
			// For bookmarkable Urls
			Backbone.history.start();
		},
		set: {
			fromHotspotClick: function($hotspot){
				var page_hotspot = $hotspot.attr('id').split('-').slice(1,3), // `hotspot-1-1` -> ["1", "1"];
						page = page_hotspot[0],
						hotspot = page_hotspot[1],
						hash = '';

				// If you've tapped on the active hotspot...
				if (states.currentPage == page && states.currentHotspot == hotspot) {
					states.lastHotspot = hotspot; // Record the last hotspot you were on. You can then pick up from here on swipe.
					hotspot = 'none'; // Set the current hotspot to none to signify you're on the page view.
					hash = page; // And in the url hash, display only the page number.
				}else{
					hash = page + '/' + hotspot; // Otherwise, send the page and hotspot to the route.
				}

				// Change the hash
				routing.router.navigate(hash, {trigger: true});
			},
			fromKeyboardOrGesture: function(direction){
				// dir can be: prev-hotspot, next-hotspot, page-view
				var pp_info = helpers.hashToPageHotspotDict( window.location.hash );
				var page_max = Number( $('#page-'+pp_info.page).attr('data-length') );
				var newhash;
				pp_info.page = pp_info.page || 1; // If there's no page, go to the first page
				pp_info.hotspot = pp_info.hotspot || states.lastHotspot || 0; // If there was no hotspot in the hash, see if there was a saved hotspot states, if not start at zero

				states.lastHotspot = pp_info.hotspot;
				// Go to previous hotspot
				if (direction == 'prev-hotspot'){
					// Decrease our hotspot cursor by one
					pp_info.hotspot--

					// If that takes us below the first hotspot, go to the full view of this page
					if (pp_info.hotspot < 1){
						if (pp_info.page != 1) pp_info.page--;
						// TODO handle first page to go back to main window or something
						states.lastHotspot = '';
						pp_info.hotspot = 'none';
					}

				// Go to next hotspot
				} else if (direction == 'next-hotspot'){
					// Increase our hotspot cursor by one
					pp_info.hotspot++;

					// If that exceeds the number of hotspots on this page, go to the full view of the next page
					if (pp_info.hotspot > page_max){
						pp_info.page++;
						pp_info.hotspot = 'none';
					}

				// Go to the page view
				} else if (direction == 'page-view'){
					pp_info.hotspot = 'none';
				}

				// Add our new info to the hash
				// or nof if we're going to a full pulle
				newhash = pp_info.page.toString();
				if (pp_info.hotspot != 'none'){
					newhash += '/' + pp_info.hotspot
				}

				// Go to there
				routing.router.navigate(newhash, {trigger: true});
			}
		},
		// Reads the route
		// Switches pages if necessary
		// Scales to page view if no hotspot is set
		// Delegates zooms to hotspot if it is
		read: function(page, hotspot, transitionDuration){
			var css;
			var page_change_direction, exiting_class, entering_class;
			// If we're changing pages
			if (states.currentPage != page){
				if ( Number(states.currentPage) < Number(page) ) {
					page_change_direction = 'next-page';
					exiting_class = 'exit-to-left';
					entering_class = 'enter-from-right';
				} else {
					page_change_direction = 'prev-page';
					exiting_class = 'exit-to-right';
					entering_class = 'enter-from-left';
				}
				console.log(states.currentPage, page, page_change_direction)

				$('#page-'+states.currentPage).addClass(exiting_class);
				$('#page-'+page).addClass(entering_class).addClass('viewing');
			}

			if (!hotspot){
				// Reset back to full page view here
				zooming.toPage( $('#page-'+page), true , true);
			}else{
				zooming.toHotspot(page, hotspot, transitionDuration);
			}

			// Save the current page and hotspot to what the route said. TK placement here. I'll have to see how all the nav mixures play out and how pagination works
			helpers.saveCurrentStates(page, hotspot);
		}
	}

	var zooming = {
		toPage: function($page, masksAlso, transitionDuration){
			// Reset zoom to full page view
			var page_css = helpers.setTransitionCss('transform', 'scale(1)', transitionDuration);
			$page.css(page_css);
			if (masksAlso){
				// Reset masks
				var mask_css = helpers.addDuration({ 'height': 0, opacity: 0 }, transitionDuration);
				$('.mask').css(mask_css);
			}
		},
		toHotspot: function(page, hotspot, transitionDuration){
			// cg means `current page`
			// th means `target hotspot`
			var buffer = .2;
			var $currentPage = $('#page-'+page),
					cg_width = $currentPage.width(),
					cg_top = $currentPage.position().top,
					viewport_xMiddle = $(window).width() / 2,
					cg_yMiddle = $currentPage.height() / 2;

			var $targetHotspot = $('#hotspot-'+page+'-'+hotspot),
					th_top = Number($targetHotspot.attr('data-top')),
					th_left = Number($targetHotspot.attr('data-left')),
					th_width = Number($targetHotspot.attr('data-width')),
					th_xMiddle = th_width / 2,
					th_yMiddle = Number($targetHotspot.attr('data-height')) / 2;

			var scale_multiplier = 1 / (th_width / cg_width); // Scale the width of the page by this to expand the target hotspot to full view
			var x_adjuster = viewport_xMiddle - th_left - th_xMiddle,
					y_adjuster = cg_yMiddle - th_top - th_yMiddle;
			console.log(cg_yMiddle, th_top, th_yMiddle)
			var css = helpers.setTransitionCss('transform', 'scale('+ scale_multiplier +') translate('+x_adjuster+'px, '+y_adjuster+'px)', transitionDuration);
			$currentPage.css(css);
			zooming.sizeMasks(th_yMiddle*2, cg_yMiddle*2, scale_multiplier, transitionDuration);
		},
		sizeMasks: function(th_height, cg_height, scaler, transitionDuration){
			var mask_height = ( cg_height - (th_height * scaler) ) / 2;
			var css = { 'height': mask_height+'px', opacity: 1 };
			css = helpers.addDuration(css, transitionDuration)
			$('.mask').css(css);
		}
	}

	var init = {
		go: function(){
			layout.bakeMasks();
			init.loadPages();
			listeners.resize();
			listeners.keyboardAndGestures();
		},
		loadPages: function(){
			$.getJSON('../data/pages.json', layout.bakePages);
		}
	}

	init.go();

}).call(this);