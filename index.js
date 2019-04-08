// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const argv = require('yargs').argv;
const api_request = require('request-promise-native');
var stringSimilarity = require('string-similarity');
const admin = require('firebase-admin');
 
process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

const rtdbModule = require('./rtdb_tests');

exports.rtdb_tests = functions.https.onRequest(rtdbModule.handler);
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {

  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  function collegescorecard_lookup(school, params) {

    let apiKey = 'mjDfVeo6RXvABJGLcVmHxOxn1jor5sL08On8fa6w';

    let alias_url = `https://api.data.gov/ed/collegescorecard/v1/schools?school.alias=${encodeURI(school)}&api_key=${apiKey}${params}`;
    
    let name_url = `https://api.data.gov/ed/collegescorecard/v1/schools?school.name=${encodeURI(school)}&api_key=${apiKey}${params}`;

    var name_data, alias_data, school_data, name_result, alias_result, alias_match, name_match = '';

    return api_request.get(alias_url)
        .then( jsonBody => {
            alias_data = JSON.parse(jsonBody);

            alias_result = '';

            if (alias_data.results[0])
                alias_result = alias_data.results[0]['school.alias'];

            school_data = alias_data;

            alias_match = stringSimilarity.compareTwoStrings(school, alias_result);

            console.log(`Alias match for query "${school}" vs "${alias_result}" is: ${alias_match}.`);
        
            return api_request.get(name_url)
            .then( jsonBody2 => {
                name_data = JSON.parse(jsonBody2);

                name_result = '';

                if (name_data.results[0])
                    name_result = name_data.results[0]['school.name'];

                name_match = stringSimilarity.compareTwoStrings(school, name_result);

                console.log(`Name match for query "${school}" vs "${name_result}" is: ${name_match}.`);

                if (name_match > alias_match) {
                    return Promise.resolve(name_data.results[0]);
                } else {
                    return Promise.resolve(alias_data.results[0]);
                }

                

            }).catch(function (err) {
                console.log("[ERROR}: " + err);
            });

        return Promise.resolve(alias_data.results[0]);

    });

  }

  function collegeai_lookup(school, params) {

    let apiKey = 'S1j4cGMraIDn';

    let url = `https://api.collegeai.com/api/college-list?api_key=${encodeURI(apiKey)}&filters=%7B%0A%22name%22%3A%22${encodeURI(school)}%22%0A%7D&info_ids=${encodeURI(params)}&limit=1`;
    
    var school_info = '';

    return api_request.get(url)
        .then( function(jsonBody) {

            let college_data = JSON.parse(jsonBody);

            //Return the first and only result
            return college_data.colleges[0];

    });
        
  }

  function clean(text) {

    return text.replace(/[^\w\s]|_/g, "");

  }
 
  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }
 
  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }

  function test_scores(agent) {

    return collegescorecard_lookup(clean(agent.parameters.college), "&_fields=id,school.name,school.alias,latest.admissions.sat_scores.average.overall,latest.admissions.act_scores.midpoint.cumulative&_sort=latest.student.size:desc").then(function (school) {

      if (school) {

        if (agent.parameters.score_type == "sat") {

          if (school['latest.admissions.sat_scores.average.overall'] != null) 
            agent.add(`The average SAT for ${school['school.name']} is a ${school['latest.admissions.sat_scores.average.overall']}.`);
          else 
            agent.add(`I'm afraid we don't have SAT data for ${school['school.name']}.`);
        
        } else if (agent.parameters.score_type == "act") {

          if (school['latest.admissions.act_scores.midpoint.cumulative'] != null) 
            agent.add(`The average <say-as interpret-as="spell-out">ACT</say-as> for ${school['school.name']} is a ${school['latest.admissions.act_scores.midpoint.cumulative']}.`);
          else 
            agent.add(`I'm afraid we don't have ACT data for ${school['school.name']}.`);
        
        } else {
          
          if (school['latest.admissions.sat_scores.average.overall'] != null && school['latest.admissions.act_scores.midpoint.cumulative'] != null) 
            agent.add(`The average SAT for ${school['school.name']} is a ${school['latest.admissions.sat_scores.average.overall']} and the average <say-as interpret-as="spell-out">ACT</say-as> score is a ${school['latest.admissions.act_scores.midpoint.cumulative']}.`);
          else if (school['latest.admissions.sat_scores.average.overall'] != null) 
            agent.add(`I only know the average SAT for ${school['school.name']}. It is a ${school['latest.admissions.sat_scores.average.overall']}.`);
          else if (school['latest.admissions.act_scores.midpoint.cumulative'] != null) 
            agent.add(`I only know the average <say-as interpret-as="spell-out">ACT</say-as> for ${school['school.name']}. It is a ${school['latest.admissions.act_scores.midpoint.cumulative']}.`);
          else 
            agent.add(`I'm afraid I don't have SAT or <say-as interpret-as="spell-out">ACT</say-as> data for ${school['school.name']}.`);

        }

      } else {
       
        agent.add(`Sorry, we couldn't find a school in our database called: ${agent.parameters.college}.`)
      
      }
  
    });

  }

  function acceptance_rate(agent) {

    return collegeai_lookup(clean(agent.parameters.college), "acceptance_rate").then(function (school) {

      if (school) {
  
          if (school.acceptanceRate != null) {
  
              acceptance_rate = Math.round(school.acceptanceRate * 100, 10);
  
          } else {
  
              acceptance_rate = "unknown";
  
          }
  
          agent.add(`${school.name} has an acceptance rate of ${acceptance_rate}%.`);
  
      } else {
  
          agent.add(`We couldn't find that school.`);
  
      }
  
    });

  }

  function school_size(agent) {

    return collegeai_lookup(clean(agent.parameters.college), "undergraduate_size").then(function (school) {

      if (school) {
  
        agent.add(`${school.name} has around ${school.undergraduateSize} undergraduate students.`);
  
      } else {
  
        agent.add(`We couldn't find that school.`);
  
      }
  
    });

  }
  
  function weather(agent) {

    let apiKey = '5e2b973ddb772dfc9d840054f8b13fb9'
    let city = agent.parameters.location;
    let url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=imperial`
      
    return api_request.get(url)
      .then( jsonBody => {
        var weather = JSON.parse(jsonBody);
        console.log(weather[0]);
        let message = `${weather.weather[0].description.charAt(0).toUpperCase() + weather.weather[0].description.substr(1)} and ${Math.round(weather.main.temp)} degrees in ${weather.name}.`;
        agent.add(message);
        
        return Promise.resolve( agent ); 
      });
        
  }

  function pad(number) {
    return (number < 10 ? '0' : '') + number
}

function convertTo12HourFormat(timeString, displayAMorPM) {

    var split = timeString.split(":");

    var AMorPM = "AM";

    if (split[0] > 12) {

        split[0] = split[0] - 12;
        AMorPM = "PM";

    }

    if (displayAMorPM)
        return split[0] + ":" + split[1] + " " + AMorPM;
    else (!displayAMorPM)
        return split[0] + ":" + split[1];

}

function getSchedule(day) {

    var tutorial, period1, period2, nutrition_break, period3, advisory, lunch, period4;

    if ([1,4,5].indexOf(day.getDay()) > -1) { //Monday, Thursday, Friday

        tutorial = {error:"none"};
        period1 = {start:"7:50", end:"9:22"};
        period2 = {start:"9:30", end:"11:02"};
        nutrition_break = {start:"11:02", end:"11:15"};
        advisory = {error:"none"};
        period3 = {start:"11:15", end:"12:48"};
        lunch = {start:"12:48", end:"13:18"}
        period4 = {start:"13:23", end:"14:55"};


    } else if (day.getDay() == 2) { //Tuesday

        tutorial = {start:"7:50", end:"8:50"};
        period1 = {start:"8:55", end:"10:06"};
        period2 = {start:"10:13", end:"11:24"};
        nutrition_break = {error: "none"};
        lunch = {start:"11:24", end:"11:54"};
        advisory = {error:"none"};
        period3 = {start:"11:59", end:"13:10"};
        period4 = {start:"13:17", end:"14:28"};

    } else if (day.getDay() == 3) { //Wednesday

        tutorial = {start:"7:50", end:"8:50"};
        period1 = {start:"8:55", end:"10:06"};
        period2 = {start:"10:13", end:"11:24"};
        advisory = {start:"11:31", end:"11:51"};
        lunch = {start:"11:51", end:"12:21"};
        nutrition_break = {error: "none"};
        period3 = {start:"12:26", end:"1:37"};
        period4 = {start:"13:44", end:"14:55"};

    } else { //Saturday, Sunday

        tutorial = {error: "none"};
        period1 = {error: "none"};
        period2 = {error: "none"};
        advisory = {error: "none"};
        lunch = {error: "none"};
        nutrition_break = {error: "none"};
        period3 = {error: "none"};
        period4 = {error: "none"};

    }

    return {tutorial, period1, period2, advisory, lunch, nutrition_break, period3, period4};

}

function getCurrentPeriod(schedule) {

    var today = new Date();

    var current_time = pad(today.getHours()) + ":" + pad(today.getMinutes());

    var current_period = "none";

    for (var property in schedule) {

        if (schedule[property]["start"] && schedule[property]["end"]) {
            
            //Comparison String
            if (Date.parse(`12/1/2018 ${current_time}`) > Date.parse(`12/1/2018 ${schedule[property]["start"]}`) && Date.parse(`12/1/2018 ${current_time}`) < Date.parse(`12/1/2018 ${schedule[property]["end"]}`)) {

                current_period = property;

            }

        }

    }

    return current_period;

}

function prettier_events(event) {

    var prettier_events = {
        tutorial:"Tutorial",
        period1: "Period 1",
        period2: "Period 2",
        advisory: "Advisory",
        lunch: "Lunch",
        nutrition_break: "Nutririon Break",
        period3: "Period 3",
        period4: "Period 4"
    };

    return prettier_events[event];

}

function teacher_location(agent) {

    if (!admin.apps.length) {

        admin.initializeApp(functions.config().firebase);
    
    }

    var requested_teacher = agent.parameters.teacher;
    var requested_period =  agent.parameters.schedule_item;

    console.log("----------- ^^^^^ NEW REQUEST ^^^^^ -----------");

    console.log("[DATA]: Requested teacher: " + requested_teacher);
    if (requested_period)
        console.log("[DATA]: Requested period: " + requested_period);

    if (!requested_period) {

        var date = new Date();

        date.setHours(date.getHours() - 8);
    
        var todaysSchedule = getSchedule(date)

        requested_period = getCurrentPeriod(todaysSchedule);

        console.log("...No period was specified. Falling back to the current period: " + requested_period);

    }

    var ref = admin.database().ref('room_chart');
    
    // Attach an asynchronous callback to read the data at our posts reference
    ref.on("value", function(snapshot) {

        //the value
        respond(snapshot.val());

        
    }, function (errorObject) {

        //failed
        respond("The read failed: " + errorObject.code);
    
    });


    function respond(teacherData) {

        console.log("...Fetched all teacher data");

        function pretty_say_room(uglyRoom) {

            var prettyRoom;

            if (isNaN(uglyRoom)) {

                if (uglyRoom == "off campus") {

                    prettyRoom = "off campus";

                } else if (teacher_location == "prep") {
                    
                    prettyRoom = "on their prep period";

                } else {

                    prettyRoom = "the " + uglyRoom;

                }

            } else {

                prettyRoom = "Room " + uglyRoom;

            }

            return prettyRoom;

        }

        var teacher_sex = 0;
        var requestedTeacherName

        if (requested_teacher.includes("."))
            requestedTeacherName = requested_teacher.split(".")[1];
        else
            requestedTeacherName = requested_teacher;
        
        if (requested_teacher.includes("s."))
            teacher_sex = 1;
        else if (requested_teacher.includes("miss")) {
            teacher_sex = 1;
            requestedTeacherName = requested_teacher.split("miss ")[1];
        } else if (requested_teacher.includes("Miss")) {
            teacher_sex = 1;
            requestedTeacherName = requested_teacher.split("Miss ")[1];
        }

        requestedTeacherName = requestedTeacherName.replace(/\s/g, '');

        console.log("...Teacher name is now pretty to match for search. New name is: " + requestedTeacherName);

        var closest_match_number = 0;
        var closest_match_teacher;
        var current_teacher_last_name;
        
        var teacher;
        for (teacher in teacherData) {

            current_teacher_last_name = teacher.split(",")[0];
            current_teacher_last_name = current_teacher_last_name.replace(/\s/g, '');

            if (teacher_sex == teacherData[teacher]["sex"]) {

                if (stringSimilarity.compareTwoStrings(current_teacher_last_name, requestedTeacherName) > closest_match_number) {

                    closest_match_number = stringSimilarity.compareTwoStrings(current_teacher_last_name, requestedTeacherName);
                    closest_match_teacher = teacher;

                }

            }

        }

        console.log("...Closest match to \"" + requestedTeacherName + "\" is \"" + closest_match_teacher + "\" with a match of " + closest_match_number + ". If match < 0.5, we will stop here.");

        var message = "We could not find the teacher you requested.";

        if (closest_match_number > 0.3) {

            console.log("...Match number was > 0.3! We'll display this info");

            var teacher_location = teacherData[closest_match_teacher][requested_period];

            console.log("...Teacher data (draft): " + teacher_location + ".");

            if (!requested_period.includes("period")) {

                console.log("...We don't know where this teacher is right now")
                teacher_location = "idk";
            
            }

            var teacher_name;

            if (teacherData[closest_match_teacher]["sex"] == "0")
                teacher_name =  "Mr. " + closest_match_teacher.split(",")[0];
            else
                teacher_name =  "Ms. " + closest_match_teacher.split(",")[0];

            console.log("...Prettier teacher name is: " + teacher_name);
                
            if (teacher_location == "prep" || teacher_location == "idk") {

                console.log("...Getting some more info about the teacher, since we don't know their exact location.")
                
                //We need to get some more data about this teacher, like where they are other periods.
                var pronoun;
                var other_rooms = [];

                if (teacherData[closest_match_teacher]["sex"] == "0")
                    pronoun = "He";
                else
                    pronoun = "She";

                if (teacherData[closest_match_teacher]["period1"] != "prep" && teacherData[closest_match_teacher]["period1"] != "off campus")
                    other_rooms.push(teacherData[closest_match_teacher]["period1"]);
                if (teacherData[closest_match_teacher]["period2"] != "prep" && teacherData[closest_match_teacher]["period2"] != "off campus" && other_rooms.indexOf(teacherData[closest_match_teacher]["period2"]) == -1)
                    other_rooms.push(teacherData[closest_match_teacher]["period2"]);
                if (teacherData[closest_match_teacher]["period3"] != "prep" && teacherData[closest_match_teacher]["period3"] != "off campus" && other_rooms.indexOf(teacherData[closest_match_teacher]["period3"]) == -1 )
                    other_rooms.push(teacherData[closest_match_teacher]["period3"]);
                if (teacherData[closest_match_teacher]["period4"] != "prep" && teacherData[closest_match_teacher]["period4"] != "off campus" && other_rooms.indexOf(teacherData[closest_match_teacher]["period4"]) == -1 )
                    other_rooms.push(teacherData[closest_match_teacher]["period4"]);

                var append = pretty_say_room(other_rooms[0]);

                if (other_rooms.length == 2)
                    append += " and " + pretty_say_room(other_rooms[1]);
                else if (other_rooms.length == 3)
                    append += ", "+ pretty_say_room(other_rooms[1]) + ", and " + pretty_say_room(other_rooms[2]);

                message = "It is currently " + teacher_name + "'s prep period. " + pronoun + " is typically in " + append + ".";

                if (teacher_location == "idk")
                        message = teacher_name + " is typically in " + append + ".";

                console.log("[MESSAGE]: " + message);

            } else {

                //We know exactly where they are right now, so let's just say it :)

                message = teacher_name + " is in " + pretty_say_room(teacherData[closest_match_teacher][requested_period]) + " during " +  prettier_events(requested_period) + ".";

                console.log("[MESSAGE]: " + message);

            }

        }

        agent.add(message);

        console.log("----------------- END REQUEST -----------------");

    
    }

}

function calendar_events(agent) {

    const CONFIG = require('./cal-settings');
    var dateFormat = require('dateformat');
    const CalendarAPI = require('node-google-calendar');
    let cal = new CalendarAPI(CONFIG);

    var query = agent.parameters.calendar_event;
    var more = agent.parameters.schedule_query;
    
    let now = new Date().toISOString();
       
    let params = {
        timeMin: now,
        q: query,
        singleEvents: true,
        orderBy: 'startTime'
    }; 	//Optional query parameters referencing google APIs
     
    return new Promise((resolve, reject) => {

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
        
            agent.add(response);

            resolve();
        
        }).catch(err => {

            agent.add('Error: listSingleEvents -' + err.message);

            reject();

            //Error
        }); 

    });

}

function schedule_info(agent) {

    var item = agent.parameters.schedule_item;
    var day = agent.parameters.date;
    var query = agent.parameters.schedule_query;

    var days = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];

    var append = "";

    if (day == null || day == "") {

        var date = new Date();

        date.setHours(date.getHours() - 8);

    } else {

        day = day.replace("-08:00", "");

        var date = new Date(day);

        append = "On " + days[date.getDay()] + "s, ";

    }

    var that_days_schedule = getSchedule(date);

    if (item == "this_period" || item == null) {

        var that_period = getCurrentPeriod(that_days_schedule);

    } else {

        var that_period = item;

    }

    if (that_period == "none") {

        agent.add ( "School is not in session right now." );

    } else {

        if(!that_days_schedule[that_period]["start"] && !that_days_schedule[that_period]["end"]) {

            agent.add ( "There is no " + prettier_events(that_period) + " on " + days[date.getDay()] + "s." );

        } else {

            //Let's make better time formats
            var startTime = convertTo12HourFormat(that_days_schedule[that_period]["start"], false);
            var endTime = convertTo12HourFormat(that_days_schedule[that_period]["end"], false);

            if (query == "start") {

                agent.add ( append + prettier_events(that_period) + " starts at " + startTime + "." );

            } else if (query == "end") {

                agent.add ( append + prettier_events(that_period) + " ends at " + endTime + "." );

            } else {

                //Return both start and end times
                agent.add ( append + prettier_events(that_period) + " starts at " + startTime + " and ends at " + endTime + "." );

            }

        }

    }

}

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  
  //Our custom intents
  intentMap.set('Weather', weather);
  intentMap.set('Test Scores', test_scores);
  intentMap.set('Acceptance Rate', acceptance_rate);
  intentMap.set('School Size', school_size);
  intentMap.set('Bell Schedule', schedule_info);
  intentMap.set('Teacher Location', teacher_location);
  intentMap.set('Calendar Events', calendar_events);
  // intentMap.set('your intent name here', yourFunctionHandler);
  // intentMap.set('your intent name here', googleAssistantHandler);
  agent.handleRequest(intentMap);
});
