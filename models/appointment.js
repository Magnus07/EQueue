var mongoose = require("mongoose");

var Schema = mongoose.Schema;

var appointmentSchema = new mongoose.Schema({
    startDateTime : Date,
    endDateTime   : Date,
    interval      : Number,
    participants  : [{ time : String, name : String, surname : String, id : Number }],
    subject       : { type: Schema.Types.ObjectId, ref: 'Subject' }
});

module.exports = mongoose.model("Appointment", appointmentSchema);