const TelegramBot = require('node-telegram-bot-api');
var mongoose      = require('mongoose');
const express     = require('express');
const bodyParser  = require('body-parser');
User              = require("./models/user");
Tutor             = require("./models/tutor");
Subjects          = require("./models/subject");
Appointment       = require("./models/appointment");


mongoose.connect(process.env.MONGODB, {useNewUrlParser: true, useUnifiedTopology: true });

const ERR_MESSAGE = "Сталася помилка, невідкладна допомога вже на підході.";

const TOKEN = process.env.TOKEN;
const url   = process.env.URL;
const port  = process.env.PORT;

// No need to pass any parameters as we will handle the updates with Express
const bot = new TelegramBot(TOKEN);

// This informs the Telegram servers of the new webhook.
bot.setWebHook(`${url}/bot${TOKEN}`);

const app = express();

// parse the updates to JSON
app.use(bodyParser.json());

// We are receiving updates at the route below!
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Start Express Server
app.listen(port, () => {
  console.log(`EQueue server is listening on ${port}`);
});


var answerCallbacks = {};


// HANDLING USER'S INPUT
// '/start' command
bot.onText(/\/start/, function (msg) {
  // trying to find user in our database
  User.findOne({ id : msg.from.id }, function (err, user) {
    if (err){
      errorHandeled(err,msg.from.id);
    }
    // if there's no such user
    if (user === null){
      bot.sendMessage(msg.chat.id, "Вам необхідно зареєструватися у системі. " +
      "Зараз вам буде запропоновано ввести своє ім'я та прізвище. " +
      "Будьте обачні! В подальшому цю інформацію неможливо буде змінити. Тож вкажіть ваше ім'я: ").then(function () {
      answerCallbacks[msg.chat.id] = function (answer) {
          var name = answer.text;
          bot.sendMessage(msg.chat.id, "Вкажіть ваше прізвище: ").then(function () {
              answerCallbacks[msg.chat.id] = function (answer) {
                  var surname = answer.text;
                  // making new user
                  var user = new User({ name : name, surname : surname, id : msg.from.id, username : msg.from.username });
                  // saving to our database
                  user.save(function(err,user){
                    // if there's an error
                    if (err){
                      errorHandeled(err,msg.chat.id, "/start");
                    } else {
                      bot.sendMessage(msg.chat.id, "Привіт, " + name + " " + surname + "! Дочекайся підтвердження свого акаунту адміністратором аби почати користуватися усіма можливостями.");
                    }
                  })
              }
          });
      }
      });
    } else if (user.approved) {
      Tutor.findOne({user : user}, function(err, tutor){
      if (err){
        errorHandeled(err,msg.chat.id, "start/findOne");
      }
      // Admin panel interface
      if (user.id == process.env.ADMIN){
        showKeyboard(user,false,true);
      }
      else if (tutor === null){
        showKeyboard(user, false);
      } else {
        showKeyboard(user, true);
      }});
     }else if (!user.approved) {
        bot.sendMessage(msg.chat.id, "Акаунт не підтверджено! Дочекайся підтвердження свого акаунту адміністратором аби почати користуватися усіма можливостями.");
      }
  });
});


bot.on('message', function (message) {
  var callback = answerCallbacks[message.chat.id];
  if (callback) {
      delete answerCallbacks[message.chat.id];
      return callback(message);
  }
});


// Handle callback queries
bot.on('callback_query', function onCallbackQuery(callbackQuery) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const answer = action.split('_');

    let text;
    if (action === 'subjects') {
        showSubjects(msg);
        return;
    }
    if (action === 'appointments') {
      showAppointments(msg);
      return;
    }
    if (action === "makeAnAppointment"){
      makeAnAppointment(msg);
      return;
    }
    if (action === "addNewSubject"){
      addNewSubject(msg);
      return;
    }
    if (action === "showNewUsers"){
      showNewUsers(msg);
      return;
    }
    if (action === "addNewTutor"){
      addNewTutor(msg);
      return;
    }
    if (action === "showTutors"){
      showTutors(msg);
      return;
    }
    if (answer[0] === "newappointment"){
      newAppointment(msg, answer[1]);
      return;
    } 
    if (answer[0] === "toappoint"){
      toAppoint(msg, answer[1]);
      return;
    }
    if (answer[0] === "queue"){
      toCheckIn(answer[1], answer[2], msg);
      return;
    }
    if (answer[0] === "toapprove"){
      toApprove(msg,answer[1]);
      return;
    }
  
    bot.sendMessage(msg.chat.id, text);
});


function showTutors(msg){
  Tutor.find({}).populate("user").exec(function(err,tutors){
    if (err){
      errorHandeled(err,msg.chat.id, showTutors.name);
    } else {
        var response = "Викладачі:\n";
        for (var i = 0; i < tutors.length; i++){
          response += (i + 1) +". " + "@" + tutors[i].user.username + tutors[i].user.name + " " + tutors[i].user.surname + "\n";
        }
        bot.sendMessage(msg.chat.id, response);
    }
  })
}


function showAppointments(msg){
  Appointment.find({}).populate('subject').exec(function(err,appointments){
    if (err){
      errorHandeled(err,msg.chat.id, showAppointments.name);
    } else {
    var response = "";
    for (var i = 0; i < appointments.length; i++){
      for (var j = 0; j < appointments[i].participants.length; j++){
        if (appointments[i].participants[j].id === msg.chat.id){
          response += appointments[i].subject.subject + " " + appointments[i].participants[j].time + "\nДата початку: " + appointments[i].startDateTime.getDate() + "/" + (appointments[i].startDateTime.getMonth() + 1) + "/" + appointments[i].startDateTime.getFullYear() + "\n";
          break;
        }
      }
    }
    if (response === "")
      response = "Наразі ви ніде не записані. Хутчіш записуйтесь!"
    bot.sendMessage(msg.chat.id, response);
  }})
}


function addNewTutor(msg){
  bot.sendMessage(msg.chat.id, "Вкажіть ім'я викладача: ").then(function () {
      answerCallbacks[msg.chat.id] = function (answer) {
          var name = answer.text;
          bot.sendMessage(msg.chat.id, "Вкажіть прізвище викладача: ").then(function () {
              answerCallbacks[msg.chat.id] = function (answer) {
                  var surname = answer.text;
                  // making new user
                  User.findOne({ name : name, surname : surname }, function(err, user){
                    if (err){
                      errorHandeled(err,msg.chat.id, addNewTutor.name);
                    }
                    else {
                      if (user === null){
                        bot.sendMessage(msg.chat.id, "Схоже, такого користувача не знайдено.");
                      } else {
                        var tutor = new Tutor({user : user});
                        tutor.save(function(err, tutor){
                          if (err){
                            errorHandeled(err,msg.chat.id, addNewTutor.name);
                          } else {
                          bot.sendMessage(msg.chat.id, "Було додано нового викладача.");
                        }
                      })}
                  }})
                    }
                  })
              }
            });
}


function toApprove(msg, id){
  User.findById(id, function(err, user){
    if (err){
      errorHandeled(err,msg.chat.id, toApprove.name);
    } else {
      user.approved = true;
      user.save(function(err, user){
        if (err){

        } else {
          bot.sendMessage(msg.chat.id, "Змінено статус на: підтверджений. Для " + user.name + " " + user.surname);
          bot.sendMessage(user.id, "Ваш обліковий запис було підтверджено адміністратором. Насолоджуйтесь усіма можливостями електронної черги:)");
        }
      })
    }
  })
}


function showNewUsers(msg){
  User.find({ approved : false }, function(err, users){
    if (err){
      errorHandeled(err,msg.chat.id, showNewUsers.name);
    } else {
      if (users.length === 0){
        bot.sendMessage(msg.chat.id, "Схоже, нових користувачів не знайдено.")
      } else {
        var response = "Нові користувачі:\n";
        var opts = [];
        for (var i = 0; i < users.length; i++){
          response += (i + 1) +". " + users[i].name + " " + users[i].surname + "\n";
          opts.push([{text : "Дати доступ " + users[i].name + " " + users[i].surname, callback_data: 'toapprove_' + users[i]._id}]);
        }
        bot.sendMessage(msg.chat.id, response, 	{ reply_markup: { inline_keyboard: opts }});
      }
    }
  })
}


function toCheckIn(appointment_id, number_in_query, msg){
  User.findOne({ id : msg.chat.id }, function(err, user){
    if (err){
      errorHandeled(err,msg.chat.id, toCheckIn.name);
    } else {
      Appointment.findById(appointment_id, function(err, appointment){
        if (err){
          errorHandeled(err,msg.chat.id, toCheckIn.name);
        } else {
          for (var i = 0; i < appointment.participants.length; i++){
            // checking if user has been checked in
            if (appointment.participants[i].id === msg.chat.id){
              appointment.participants[i].name = "";
              appointment.participants[i].surname = "";
              appointment.participants[i].id = -1;
            }
          }
          // if the place is busy
          if (appointment.participants[number_in_query].name != "" && appointment.participants[number_in_query].surname != "" && appointment.participants[number_in_query].id != -1){
            bot.sendMessage(msg.chat.id, "На жаль, ви не можете записатися у вказаний час. Певно хтось вас випередив.");
          }
          else {
            appointment.participants[number_in_query].name = user.name;
            appointment.participants[number_in_query].surname = user.surname;
            appointment.participants[number_in_query].id = user.id;
            appointment.save(function(err, appointment){
              if (err){
                errorHandeled(err,msg.chat.id, toCheckIn.name);
              } else {
                bot.sendMessage(msg.chat.id, "Вас записано у чергу.");
              }
            })
          }
        }
      })
    }
  })
}


function toAppoint(msg, subjectID){
  Appointment.findOne({ subject : subjectID }, function(err, appointment){
    if (err){
      errorHandeled(err,msg.chat.id, toAppoint.name);
    } else {
      if (appointment === null){
        bot.sendMessage(msg.chat.id, "На жаль, наразі немає доступних можливостей для запису за обраною дисципліною.");
      } else {
        peopleInQueue = getCountOfPeopleInQueue(appointment.startDateTime, appointment.endDateTime, appointment.interval);
        var opts = [];
        for (var i = 0; i < appointment.participants.length; i++){
          opts.push([{text : appointment.participants[i].time + "   "+ appointment.participants[i].name + " " + appointment.participants[i].surname, callback_data: 'queue_' + appointment._id + "_" + i}]);
        }
        bot.sendMessage(msg.chat.id, " Найближчий запис доступний " + (appointment.startDateTime.getDate()) + "/" + (appointment.startDateTime.getMonth() + 1) + "/" + (appointment.startDateTime.getFullYear()) + " о " + (appointment.startDateTime.getHours()) + ":" + (appointment.startDateTime.getMinutes()) + ". Усього місць: " + peopleInQueue + ". Ви можете зайняти будь-яке вільне місце: ", { reply_markup: { inline_keyboard: opts }});
      }
    }
  })
}


function getTimeInQueue(startHours, startMinutes, interval, counter){
  startMinutes += interval * counter;
  while (startMinutes >= 60){
    startHours++;
    startMinutes -= 60;
  }
  // if there's one figure after arithmetic operations
  if (startMinutes < 10)
    startMinutes = '0' + startMinutes.toString();
  return startHours + ":" + startMinutes;
}


function getCountOfPeopleInQueue(startDateTime, endDateTime, interval){
  return parseInt((endDateTime - startDateTime)/60000 / interval);
}


function addNewSubject(msg){
  User.findOne({ id : msg.chat.id }, function(err, user){
    if (err){
      errorHandeled(err,msg.chat.id, addNewSubject.name);
    } else {
      bot.sendMessage(msg.chat.id, "Вкажіть назву навчальної дисципліни: ").then(function () {
      answerCallbacks[msg.chat.id] = function (answer) {
      var subject = new Subjects({ subject : answer.text });
      subject.save(function(err, subject){
        if (err){

        } else {
          Tutor.findOne({ user : user }, function(err, tutor){
            if (err){
              errorHandeled(err,msg.chat.id, addNewSubject.name);
            } else {
              tutor.subjects.push(subject);
              tutor.save(function(err, tutor){
                if (err){

                } else {
                  bot.sendMessage(msg.chat.id, "Навчальна дисципліна \"" + subject.subject + "\" успішно створена");
                }
              })
            }
          })
        }
      })}
    }
  )}})
}


function showSubjects(msg){
  Subjects.find({}, function(err, subjects){
    if (err){
      errorHandeled(err,msg.chat.id, showSubjects.name);
    } else {
      var response = "Дисципліни:\n";
      var opts = [];
      for (var i = 0; i < subjects.length; i++){
        response += (i + 1) +". " + subjects[i].subject + "\n";
        opts.push([{text : subjects[i].subject, callback_data: 'toappoint_' + subjects[i]._id}]);
      }
      response += "Ви можете записатися на одну з дисциплін: ";
      bot.sendMessage(msg.chat.id, response, 	{ reply_markup: { inline_keyboard: opts }});
    }
  })
}


function makeAnAppointment(msg){
  User.findOne({ id : msg.chat.id }, function(err, user){
    if (err){
      errorHandeled(err,msg.chat.id, makeAnAppointment.name);
    } else {
      Tutor.findOne({ user : user }).populate("subjects").exec(function(err, tutor){
        if (err){
          errorHandeled(err,msg.chat.id, makeAnAppointment.name);
        } else {
          if (tutor === null){
            errorHandeled(err, msg.chat.id, "Ця команда недоступна для вас;)");
          } else {
            var response = "Дисципліни:\n";
            var opts = [];
            for (var i = 0; i < tutor.subjects.length; i++){
              response += (i + 1) +". " + tutor.subjects[i].subject + "\n";
              opts.push([{text : tutor.subjects[i].subject, callback_data: 'newappointment_' + tutor.subjects[i]._id}]);
            }
            response += "Оберіть дисципліну, для якої хочете створити електронну чергу: ";
            bot.sendMessage(msg.chat.id, response, 	{ reply_markup: { inline_keyboard: opts }});
          }
        }
      })
    }
  })
}


function newAppointment(msg, subjectID){
  Appointment.findOne({subject : subjectID}, function(err,appointment){
    if (err){
      errorHandeled(err,msg.chat.id, newAppointment.name);
    } else {
      if (appointment === null){
        bot.sendMessage(msg.chat.id, "Вкажіть дату події у форматі \"день/місяць/рік\" . Наприклад: 01/02/2021 : ").then(function () {
          answerCallbacks[msg.chat.id] = function (answer) {
            var data = answer.text.split("/");
            bot.sendMessage(msg.chat.id, "Тепер вкажіть час початку. Наприклад: 15:40 : ").then(function () {
              answerCallbacks[msg.chat.id] = function (answer) {
                startTime = answer.text.split(":");
                var startDateTime = new Date(data[2],parseInt(data[1])-1,parseInt(data[0]), startTime[0], startTime[1]);
                bot.sendMessage(msg.chat.id, "Тепер вкажіть час завершення. Наприклад: 18:40 : ").then(function () {
                  answerCallbacks[msg.chat.id] = function (answer) {
                    endTime = answer.text.split(":");
                    var endDateTime = new Date(data[2], parseInt(data[1]) - 1, parseInt(data[0]),endTime[0], endTime[1] );
                    var minutes = (endDateTime - startDateTime)/60000;
                    bot.sendMessage(msg.chat.id, "А тепер вкажіть час на одну людину. Час на одну людину обчислюється у хвилинах. Ви можете ввести наприклад \"15\" : ").then(function () {
                      answerCallbacks[msg.chat.id] = function (answer) {
                        interval = parseInt(answer.text);
                        var peopleInQueue = parseInt(minutes / interval);
                        var participants = [];
                        for (var i = 0; i < peopleInQueue; i++){
                          participants.push({time : getTimeInQueue(startDateTime.getHours(), startDateTime.getMinutes(), interval, i), name : "", surname : "", id : -1});
                        }
                        var appointment = new Appointment({startDateTime : startDateTime, endDateTime : endDateTime, interval : interval, subject : subjectID, participants : participants});
                        appointment.save(function(err, appointment){
                          if (err){
                            errorHandeled(err,msg.chat.id, newAppointment.name);
                          } else {
                            bot.sendMessage(msg.chat.id, "Успішно збережено. Очікуйте купу студентів :)")
                          }
                        })
                      }})
                  }})
              }})
          }})
      } else {
        bot.sendMessage(msg.chat.id, "Електронна черга вже сформована на цю дисципліну. Якщо ви хочете видалити її і створити нову, уведіть \"так\"").then(function () {
          answerCallbacks[msg.chat.id] = function (answer) {
            if (answer.text === 'так'){
              appointment.remove(function(err){
                if (err){
                  errorHandeled(err,msg.chat.id, newAppointment.name);
                } else{
                  bot.sendMessage(msg.chat.id, "Попередня черга була видалена.")
                }
              })
            }
          }})
     } }
  })
}


function showKeyboard(user, isTutor, isAdmin = false){
  var opts;
  if (isAdmin){
    opts = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: ' 🎓 Доступні дисципліни',
              // we shall check for this value when we listen
              // for "callback_query"
              callback_data: 'subjects'
            }
          ],
            [{
                text: ' 📝 Мої записи',
                // we shall check for this value when we listen
                // for "callback_query"
                callback_data: 'appointments'
              }
          ],
          [
            {
              text: ' 📝 Показати нових користувачів',
              // we shall check for this value when we listen
              // for "callback_query"
              callback_data: 'showNewUsers'
            }
          ],
          [
            {
              text: ' 📝 Показати викладачів',
              // we shall check for this value when we listen
              // for "callback_query"
              callback_data: 'showTutors'
            }
          ],
          [
            {
              text: ' 🎓 Додати викладача',
              // we shall check for this value when we listen
              // for "callback_query"
              callback_data: 'addNewTutor'
            }
          ],
          [
            {
              text: ' 🎓 Додати навчальну дисципліну',
              // we shall check for this value when we listen
              // for "callback_query"
              callback_data: 'addNewSubject'
            }
          ],
          [
            {
              text: ' 📝 Додати можливість запису для студентів',
              // we shall check for this value when we listen
              // for "callback_query"
              callback_data: 'makeAnAppointment'
            }
          ]
        ]
      }
    }
  }
  else if (isTutor){
    // inline keyboard init
    opts = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: ' 🎓 Додати навчальну дисципліну',
              // we shall check for this value when we listen
              // for "callback_query"
              callback_data: 'addNewSubject'
            }
          ],
          [
            {
              text: ' 📝 Додати можливість запису для студентів',
              // we shall check for this value when we listen
              // for "callback_query"
              callback_data: 'makeAnAppointment'
            }
          ]
        ]
      }
    }
  } else {
      // inline keyboard init
      opts = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: ' 🎓 Доступні дисципліни',
                // we shall check for this value when we listen
                // for "callback_query"
                callback_data: 'subjects'
              }
            ],
              [{
                  text: ' 📝 Мої записи',
                  // we shall check for this value when we listen
                  // for "callback_query"
                  callback_data: 'appointments'
                }
              ]
          ]
        }
      }
  }
  bot.sendMessage(user.id, 'Вітаємо! Декілька опцій для вас: ', opts);
}


function messageAdmin(err, id){
  bot.sendMessage(process.env.ADMIN, 'Error handeled: \nMessage from id: ' + id + "\nError body: " + err);
}


function errorHandeled(err,id, func = null, message = ERR_MESSAGE){
    messageAdmin("Error " + err, " for id№" + id," in function " + func);
    console.log(err);
    bot.sendMessage(id, message);
}