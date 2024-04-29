var mongoose = require('mongoose');  
var projectMembersSchema = new mongoose.Schema({  
  id_clana: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  id_projekta: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project'
  }
});
mongoose.model('ProjectMembers', projectMembersSchema);