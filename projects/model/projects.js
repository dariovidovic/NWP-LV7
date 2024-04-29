var mongoose = require('mongoose');  

var projectSchema = new mongoose.Schema({  
  naziv_projekta: {
    type: String,
    required: true
  },
  opis_projekta: {
    type: String,
    required: true
  },
  cijena_projekta: {
    type: Number,
    required: true
  },
  obavljeni_poslovi: {
    type: String,
  },
  datum_pocetka: {
    type: Date,
    default: Date.now
  },
  datum_zavrsetka: {
    type: Date,
    validate: {
      validator: function (value) {
          return value > this.datum_pocetka;
      },
      message: 'End date must be after start date'
  }
  },
  isArchived: {
    type: Boolean,
    default: false 
  },
  projectLeaderId: {
    type: mongoose.Schema.Types.ObjectId, 
    required: true
  }
});
mongoose.model('Project', projectSchema);