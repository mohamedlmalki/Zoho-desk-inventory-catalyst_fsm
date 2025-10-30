const { makeApiCall, parseError } = require('./utils');

let activeJobs = {};

const setActiveJobs = (jobsObject) => {
  activeJobs = jobsObject;
};

// This function will test the 'Qntrl.user.READ' scope,
// as the /blueprint/api/ endpoints require Zoho CRM.
const handleGetEmailTemplates = async (socket, data) => {
    
};

module.exports = {
    setActiveJobs,
    handleGetEmailTemplates,
};