const functions = require('firebase-functions');
const admin = require('firebase-admin');
var stringSimilarity = require('string-similarity');

var requested_teacher = "Mrs. Merideth";
var requested_period = "period2"; 

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


exports.handler = (request, response) => {

    admin.initializeApp(functions.config().firebase);

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

        var teacher_sex = 0;
        var requestedTeacherName = requested_teacher.split(". ")[1];
        
        if (requested_teacher.includes("s."))
            teacher_sex = 1;
        else if (requested_teacher.includes("miss")) {

            teacher_sex = 1;
            var requestedTeacherName = requested_teacher.split("miss ")[1];
            
        }

        var closest_match_number = 0;
        var closest_match_teacher;
        var current_teacher_last_name;
        
        for (teacher in teacherData) {

            current_teacher_last_name = teacher.split(", ")[0];

            if (teacher_sex == teacherData[teacher]["sex"]) {

                if (stringSimilarity.compareTwoStrings(current_teacher_last_name, requestedTeacherName) > closest_match_number) {

                    closest_match_number = stringSimilarity.compareTwoStrings(current_teacher_last_name, requestedTeacherName);
                    closest_match_teacher = teacher;

                }

            }

        }

        var message = "We could not find the teacher you requested.";

        if (requested_period.includes("period"))
            message = "Please specify a class period.";
        else if (closest_match_number > 0.5) {

            var teacher_location = teacherData[closest_match_teacher][requested_period];
            var teacher_name;

            if (teacherData[closest_match_teacher]["sex"] == "0")
                teacher_name =  "Mr. " + closest_match_teacher.split(", ")[0];
            else
                teacher_name =  "Ms. " + closest_match_teacher.split(", ")[0];


            if (isNaN(teacher_location)) {

                if (teacher_location == "off campus") {

                    message = teacher_name + " is off campus during " + prettier_events(requested_period);

                } else if (teacher_location == "prep") {
                    
                    var pronoun;
                    var other_rooms = [];

                    if (teacherData[closest_match_teacher]["sex"] == "0")
                        pronoun = "He";
                    else
                        pronoun = "She";

                    if (!isNaN(teacherData[closest_match_teacher]["period1"]))
                        other_rooms.push(teacherData[closest_match_teacher]["period1"]);
                    if (!isNaN(teacherData[closest_match_teacher]["period2"]) && other_rooms.indexOf(teacherData[closest_match_teacher]["period2"]) == -1)
                        other_rooms.push(teacherData[closest_match_teacher]["period2"]);
                    if (!isNaN(teacherData[closest_match_teacher]["period3"]) && other_rooms.indexOf(teacherData[closest_match_teacher]["period3"]) == -1 )
                        other_rooms.push(teacherData[closest_match_teacher]["period3"]);
                        if (!isNaN(teacherData[closest_match_teacher]["period4"]) && other_rooms.indexOf(teacherData[closest_match_teacher]["period4"]) == -1 )
                        other_rooms.push(teacherData[closest_match_teacher]["period4"]);

                    append = other_rooms[0];

                    if (other_rooms.length == 2)
                        append += " and Room " + other_rooms[1];
                    else if (other_rooms.length == 3)
                        append += ", Room " + other_rooms[1] + ", and Room " + other_rooms[3];

                    message = "It is currently " + teacher_name + "'s prep period. " + pronoun + " teaches in Room " + append + ".";

                } else {

                    message = teacher_name + " is in the " + teacherData[closest_match_teacher][requested_period] + " during " +  prettier_events(requested_period) + ".";

                }

            } else {

                message = teacher_name + " is in Room " + teacherData[closest_match_teacher][requested_period] + " during " +  prettier_events(requested_period) + ".";

            }

        }

        //send to http server
        response.status(200).send(message);
    
    }
};