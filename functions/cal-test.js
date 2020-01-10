const CONFIG = require('./cal-settings');

var dateFormat = require('dateformat');

const CalendarAPI = require('node-google-calendar');

let cal = new CalendarAPI(CONFIG);

var query = "swim practice";
var more = "end";

let now = new Date().toISOString();
   
let params = {
    timeMin: now,
    q: query,
    singleEvents: true,
    orderBy: 'startTime'
}; 	//Optional query parameters referencing google APIs
 
cal.Events.list('bpmct.net_5p6q5ikspdqbm5m6mi2ag72i2k@group.calendar.google.com', params)
  .then(events => {

    if (events[0]) {
      
      const monthName = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      var dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      function ordinal_suffix_of(i) {
        var j = i % 10,
            k = i % 100;
        if (j == 1 && k != 11) {
            return i + "st";
        }
        if (j == 2 && k != 12) {
            return i + "nd";
        }
        if (j == 3 && k != 13) {
            return i + "rd";
        }
        return i + "th";
    }

      var event_title = events[0]["summary"];

      var event_start = new Date(events[0]["start"].dateTime).toLocaleString("en-US", {timeZone: "America/Los_Angeles"});
      event_start = new Date(event_start);
      var event_start_date = monthName[event_start.getMonth()] + " " + ordinal_suffix_of(event_start.getDate());
      var event_start_time = dateFormat(event_start, "h:MM TT");

      var event_end = new Date(events[0]["end"].dateTime).toLocaleString("en-US", {timeZone: "America/Los_Angeles"});
      event_end = new Date(event_end);

      var event_end_date = monthName[event_end.getMonth()] + " " + ordinal_suffix_of(event_end.getDate());
      var event_end_time = dateFormat(event_end, "h:MM TT");

      var response = "The " + event_title + " is " + dayName[event_start.getDay()] + " " + event_start_date + " at " + event_start_time + ".";

      if (more == "start") {
      
        var response = "The " + event_title + " starts " + dayName[event_start.getDay()] + " " + event_start_date + " at " + event_start_time + ".";
      
      } else if (more == "end") {
      
        var response = "The " + event_title + " ends " + dayName[event_start.getDay()] + " " + event_end_date + " at " + event_end_time + ".";
      
      }

      } else {

        response = "We could not find an event called " + query + ".";

      }

    console.log(response);

  }).catch(err => {
    //Error
    console.log('Error: listSingleEvents -' + err.message);
  });