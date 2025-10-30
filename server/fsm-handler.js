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

const handleStartBulkCreateContact = async (socket, data) => {
    const { emails, lastName, delay, selectedProfileName, activeProfile } = data;
    const jobId = createJobId(socket.id, selectedProfileName, 'fsm-contact');
    activeJobs[jobId] = { status: 'running' };

    try {
        if (!activeProfile || !activeProfile.fsm) {
            throw new Error('FSM profile configuration is missing.');
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

            const contactData = {
                data: [
                    {
                        Last_Name: lastName,
                        Email: email,
                    }
                ]
            };

            try {
                const response = await makeApiCall('post', '/Contacts', contactData, activeProfile, 'fsm');
                
                socket.emit('fsmContactResult', { 
                    email, 
                    success: true,
                    details: `Contact created successfully.`,
                    fullResponse: response.data,
                    profileName: selectedProfileName
                });

            } catch (error) {
                const { message, fullResponse } = parseError(error);
                socket.emit('fsmContactResult', { email, success: false, error: message, fullResponse, profileName: selectedProfileName });
            }
        }

    } catch (error) {
        socket.emit('bulkError', { message: error.message || 'A critical server error occurred.', profileName: selectedProfileName, jobType: 'fsm-contact' });
    } finally {
        if (activeJobs[jobId]) {
            const finalStatus = activeJobs[jobId].status;
            if (finalStatus === 'ended') {
                socket.emit('bulkEnded', { profileName: selectedProfileName, jobType: 'fsm-contact' });
            } else {
                socket.emit('bulkComplete', { profileName: selectedProfileName, jobType: 'fsm-contact' });
            }
            delete activeJobs[jobId];
        }
    }
};

const handleCreateAndSendFsmInvoice = async (socket, data) => {
    const { invoiceData, delay, selectedProfileName, activeProfile } = data;
    const jobId = createJobId(socket.id, selectedProfileName, 'fsm-invoice');
    activeJobs[jobId] = { status: 'running' };

    try {
        if (!activeProfile || !activeProfile.fsm) {
            throw new Error('FSM profile configuration is missing.');
        }

        for (let i = 0; i < invoiceData.length; i++) {
            if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;
            while (activeJobs[jobId]?.status === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (i > 0 && delay > 0) await interruptibleSleep(delay * 1000, jobId);
            if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;

            const { workOrderId, email } = invoiceData[i];
            let invoiceId = null;

            try {
                // Step 1: Create the Invoice
                const createInvoicePayload = { data: [{ "Work_Order": workOrderId }] };
                const createResponse = await makeApiCall('post', '/Invoices', createInvoicePayload, activeProfile, 'fsm');

                if (createResponse.data.data.Invoices[0].finance_data.status !== 'success') {
                    throw new Error(createResponse.data.data.Invoices[0].finance_data.message || 'Failed to create invoice.');
                }
                
                invoiceId = createResponse.data.data.Invoices[0].finance_data.Invoice_Id;

                socket.emit('fsmInvoiceResult', { 
                    workOrderId, 
                    email,
                    step: 'create',
                    success: true,
                    details: `Invoice ${invoiceId} created.`,
                    fullResponse: createResponse.data,
                    profileName: selectedProfileName
                });

                // Step 2: Send the Invoice
                const sendInvoicePayload = { data: { to_mail_ids: [email], send_from_org_email_id: true, send_invoice_pdf: true } };
                const sendResponse = await makeApiCall('post', `/Invoices/${invoiceId}/actions/send_invoice`, sendInvoicePayload, activeProfile, 'fsm');

                if (sendResponse.data.status !== 'success') {
                    throw new Error(sendResponse.data.message || 'Failed to send invoice email.');
                }
                
                socket.emit('fsmInvoiceResult', { 
                    workOrderId, 
                    email,
                    step: 'send',
                    success: true,
                    details: `Invoice ${invoiceId} sent to ${email}.`,
                    fullResponse: sendResponse.data,
                    profileName: selectedProfileName
                });


            } catch (error) {
                const { message, fullResponse } = parseError(error);
                const step = invoiceId ? 'send' : 'create';
                socket.emit('fsmInvoiceResult', { workOrderId, email, step, success: false, error: message, fullResponse, profileName: selectedProfileName });
            }
        }
    } catch (error) {
        socket.emit('bulkError', { message: error.message || 'A critical server error occurred.', profileName: selectedProfileName, jobType: 'fsm-invoice' });
    } finally {
        if (activeJobs[jobId]) {
            const finalStatus = activeJobs[jobId].status;
            if (finalStatus === 'ended') {
                socket.emit('bulkEnded', { profileName: selectedProfileName, jobType: 'fsm-invoice' });
            } else {
                socket.emit('bulkComplete', { profileName: selectedProfileName, jobType: 'fsm-invoice' });
            }
            delete activeJobs[jobId];
        }
    }
};

module.exports = {
    setActiveJobs,
    handleStartBulkCreateContact,
    handleCreateAndSendFsmInvoice,
};