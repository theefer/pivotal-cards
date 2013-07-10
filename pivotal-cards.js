/*
 *
 *  Print a https://www.pivotaltracker.com view as index cards
 *
 *  depends on jQuery and Underscore and the Pivotal code ..
 *
 *  released under the WTFPL licence
 *
 *  https://github.com/psd/pivotal-cards
 *
 */
(function ($) {

	var options = {
		"filing-colours": true,
		"rubber-stamp": true,
		"double-sided": true,
		"white-backs": true
	};

	var make_front = _.template(
		'<div class="<%= story_type %> card" id="front-<%= cardno %>">' +
		'	<div class="front side">' +
		'		<div class="header">' +
		'			<span class="labels">' +
		'<% _.each(labels, function(label) { %> <span class="label"><%= label %></span> <% }); %>' +
		'			<span>' +
		'		</div>' +
		'		<div class="middle">' +
		'			<div class="story-title"><%= name %></div>' +
		'			<div class="story-type"><%= story_type %></div>' +
		'		</div>' +
		'		<div class="footer">' +
		'			<span class="epic_name"><%= epic_name %></span>' +
		'			<span class="points points<%= points %>"><span><%= points %></span></span>' +
		'		</div>' +
		'	</div>' +
		'</div>');

	var make_back = _.template(
		'<div class="<%= story_type %> card" id="back-<%= cardno %>">' +
		'	<div class="back side">' +
		'		<div class="header">' +
		'			<span class="project"><%= project_name %></span>' +
		'			<span class="id"><%= id %></span>' +
		'		</div>' +
		'		<div class="middle">' +
		'			<div class="story-title"><%= name %></div>' +
		'			<div class="description"><%= description %></div>' +
		'			<table class="tasks">' +
		'<% _.each(tasks, function(task) { %><tr>' +
		'			<td class="check <%= task._complete ? "complete" : "incomplete" %>"><%= task._complete ? "☑" : "☐" %></td>' +
		'			<td class="task"><%= task._description %></td>' +
		'</tr><% }); %>' +
		'			</table>' +
		'		</div>' +
		'		<div class="footer">' +
		'			<% if (requester) { %><span class="requester"><%= requester %></span><% } %>' +
		'			<% if (owner) { %><span class="owner"><%= owner %></span><% } %>' +
		'		</div>' +
		'	</div>' +
		'</div>');

	/*
	 *  overlay with printable pages
	 *
	 *  TBD: really should make a dismissable overlay
	 */
	$('body > *').hide();
	var main = $('<div id="pivotal-cards-pages"></div>');
	_.each(options, function(value, option) {
		if (value) {
			main.addClass(option);
		}
	});
	$('body').append(main);

	/*
	 *  Find visible items
	 */

        var ids = $('.ghx-selected').map(function(){
            return $(this).data('issue-key');
        });

        ids = _.uniq(ids);

	/*
	 *  build cards
	 */
	var cardno = 0;
	var fronts = [];
	var backs = [];

        var issues = []
        var deferreds = _.map(ids, function(id) {
            return $.ajax('https://jira.gutools.co.uk/rest/api/latest/issue/' + id).then(function(iss) {
                issues.push(iss)
            });
        });


        function render() {
            console.log("OK", issues);

	    _.each(issues, function (story) {
		var item;
		var card;

		if (story) {
		    var labels = [];
		    var epic_name = "";

		    _.each(story.fields.labels, function(label) {
                        // TODO
			// if (app.project.getEpicByLabel(label)) {
			// 	epic_name = label;
			// } else {
			labels.push(label);
			// }
		    });

		    var points = story.fields.customfield_10003;
		    var name = story.fields.summary || "";
		    name = name.replace(/\band\b|&/g, '<span class="amp">&amp;</span>');

                    var tasks = _.map(story.fields.subtasks || [], function(task) {
                        return {
                            _complete: task.fields.status === 'Closed', // TODO: all statuses?
                            _description: task.fields.summary
                        };
                    });


		    item = {
			cardno: cardno,
			story_type: story.fields.issuetype.name.toLowerCase(),
			id: story.key,
			name: name,
			description: story.fields.description || "",
			// epic_name: epic_name, // TODO
			epic_name: '',
			project_name: story.fields.project.name,
			labels: labels,
			tasks: tasks,
			// requester: story.fields.reporter.name,
			requester: '', // TODO
			owner: story.fields.reporter.name,
			points: points > 0 ? points : ""
		    };

		    if (item.story_type === "chore" && item.name.match(/\?\s*$/)) {
			item.story_type = "spike";
		    }

		    if (item.story_type === "story") {
			item.story_type = "feature";
		    }

		    /*
		     *  make cards using templates
		     */
		    card = make_front(item);
		    fronts.push($(card));

		    card = make_back(item);
		    backs.push($(card));

		    cardno++;
		}
                console.log("DONE ISSUE")
	    });

	    /*
	     *  layout cards 
	     */
	    function double_sided() {
		var cardno;
		var front_page;
		var back_page;

		for (cardno = 0; cardno < fronts.length; cardno++) {
		    if ((cardno % 4) === 0) {
			front_page = $('<div class="page fronts"></div>');
			main.append(front_page);

			back_page = $('<div class="page backs"></div>');
			main.append(back_page);
		    }
		    front_page.append(fronts[cardno]);
		    back_page.append(backs[cardno]);

		    /*
		      if (!(cardno % 2)) {
		      } else {
		      $(back_page).children().last().before(backs[cardno]);
		      }
		    */
		}
	    }

	    function single_sided() {
		var cardno;
		var page;

		for (cardno = 0; cardno < fronts.length; cardno++) {
		    if ((cardno % 2) === 0) {
			page = $('<div class="page"></div>');
			main.append(page);
		    }
		    page.append(fronts[cardno]);
		    page.append(backs[cardno]);
		}
	    }

	    if (options['double-sided']) {
		double_sided();
	    } else {
		single_sided();
	    }
        }

        $.when(deferreds).then(function() {
            // Stupidly, jQuery's implementation of Promise/A is
            // flawed so this is triggered before the `then` of the
            // individual deferreds, which means the issues list is
            // not populated yet. Work around this by yielding here.
            setTimeout(render, 1000);
        });

}(jQuery));
