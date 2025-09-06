// In server/catalyst-handler.js

const { makeApiCall, parseError, createJobId } = require('./utils');

let activeJobs = {};

const setActiveJobs = (jobsObject) => {
  activeJobs = jobsObject;
};

const interruptibleSleep = (ms, jobId) => {
    return new Promise(resolve => {
        if (ms <= 0) return resolve();
        const interval = 100;
        let elapsed = 0;
        const timerId = setInterval(() => {
            if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') {
                clearInterval(timerId);
                return resolve();
            }
            elapsed += interval;
            if (elapsed >= ms) {
                clearInterval(timerId);
                resolve();
            }
        }, interval);
    });
};

const handleStartBulkSignup = async (socket, data) => {
    const { emails, firstName, lastName, delay, selectedProfileName, activeProfile } = data;
    const jobId = createJobId(socket.id, selectedProfileName, 'catalyst');
    activeJobs[jobId] = { status: 'running' };

    try {
        if (!activeProfile || !activeProfile.catalyst || !activeProfile.catalyst.projectId) {
            throw new Error('Catalyst profile or Project ID is not configured.');
        }

        for (let i = 0; i < emails.length; i++) {
            if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;
            while (activeJobs[jobId]?.status === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (i > 0 && delay > 0) await interruptibleSleep(delay * 1000, jobId);
            if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;

            const email = emails[i];
            if (!email.trim()) continue;

            const signupData = {
                platform_type: 'web',
                user_details: {
                    first_name: firstName,
                    last_name: lastName,
                    email_id: email,
                }
            };

            try {
                const projectId = activeProfile.catalyst.projectId;
                const response = await makeApiCall('post', `/baas/v1/project/${projectId}/project-user/signup`, signupData, activeProfile, 'catalyst');
                
                socket.emit('catalystResult', { 
                    email, 
                    success: true,
                    details: `User ${response.data.data.user_details.first_name} ${response.data.data.user_details.last_name} created successfully.`,
                    fullResponse: response.data,
                    profileName: selectedProfileName
                });

            } catch (error) {
                const { message, fullResponse } = parseError(error);
                socket.emit('catalystResult', { email, success: false, error: message, fullResponse, profileName: selectedProfileName });
            }
        }

    } catch (error) {
        socket.emit('bulkError', { message: error.message || 'A critical server error occurred.', profileName: selectedProfileName, jobType: 'catalyst' });
    } finally {
        if (activeJobs[jobId]) {
            const finalStatus = activeJobs[jobId].status;
            if (finalStatus === 'ended') {
                socket.emit('bulkEnded', { profileName: selectedProfileName, jobType: 'catalyst' });
            } else {
                socket.emit('bulkComplete', { profileName: selectedProfileName, jobType: 'catalyst' });
            }
            delete activeJobs[jobId];
        }
    }
};

const handleSingleSignup = async (data) => {
    const { email, firstName, lastName, selectedProfileName } = data;
    if (!email || !firstName || !lastName || !selectedProfileName) {
        return { success: false, error: 'Missing required fields.' };
    }
    
    const profiles = require('./utils').readProfiles();
    const activeProfile = profiles.find(p => p.profileName === selectedProfileName);

    if (!activeProfile || !activeProfile.catalyst || !activeProfile.catalyst.projectId) {
        return { success: false, error: 'Catalyst profile or Project ID not configured.' };
    }

    const signupData = {
        platform_type: 'web',
        user_details: {
            first_name: firstName,
            last_name: lastName,
            email_id: email,
        }
    };

    try {
        const projectId = activeProfile.catalyst.projectId;
        const response = await makeApiCall('post', `/baas/v1/project/${projectId}/project-user/signup`, signupData, activeProfile, 'catalyst');
        return { 
            success: true, 
            message: `User created successfully.`,
            fullResponse: response.data
        };
    } catch (error) {
        const { message, fullResponse } = parseError(error);
        return { success: false, error: message, fullResponse };
    }
};

// NEW: Function to get all users
const handleGetAllUsers = async (socket, data) => {
    try {
        const { activeProfile } = data;
        if (!activeProfile || !activeProfile.catalyst || !activeProfile.catalyst.projectId) {
            throw new Error('Catalyst profile not found for fetching users.');
        }
        
        const projectId = activeProfile.catalyst.projectId;
        const response = await makeApiCall('get', `/baas/v1/project/${projectId}/project-user`, null, activeProfile, 'catalyst');
        
        socket.emit('catalyst:usersResult', { success: true, users: response.data.data || [] });
    } catch (error) {
        const { message } = parseError(error);
        socket.emit('catalyst:usersResult', { success: false, error: message });
    }
};

// NEW: Function to delete users
const handleDeleteUsers = async (socket, data) => {
    try {
        const { activeProfile, userIds } = data;
        if (!activeProfile || !activeProfile.catalyst || !activeProfile.catalyst.projectId) {
            throw new Error('Catalyst profile not found for deleting users.');
        }
        if (!userIds || userIds.length === 0) {
            throw new Error('No user IDs selected for deletion.');
        }
        
        const projectId = activeProfile.catalyst.projectId;
        let deletedCount = 0;
        for (const userId of userIds) {
            await makeApiCall('delete', `/baas/v1/project/${projectId}/project-user/${userId}`, null, activeProfile, 'catalyst');
            deletedCount++;
        }
        
        socket.emit('catalyst:usersDeletedResult', { success: true, deletedCount });
    } catch (error) {
        const { message } = parseError(error);
        socket.emit('catalyst:usersDeletedResult', { success: false, error: message });
    }
};

module.exports = {
    setActiveJobs,
    handleStartBulkSignup,
    handleSingleSignup,
    handleGetAllUsers,
    handleDeleteUsers,
};