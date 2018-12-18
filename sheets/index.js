const ssmStore = require('aws-param-store');
const GoogleSpreadsheet = require('google-spreadsheet');
const randomatic = require('randomatic');
const getKeys = ssmStore.getParameterSync([
    'bothr-clientEmail',
    'bothr-privateKey',
    'bothr-sheetId'
], {
    region: 'ap-southeast-1'
});

const config = {
    client_email: getKeys.Parameters[0].Value,
    private_key: getKeys.Parameters[1].Value
};

const sheets = new GoogleSpreadsheet(getKeys.Parameters[2].Value);

const gsService = fn => {
    return new Promise((resolve, reject) => {
        sheets.useServiceAccountAuth(config, () => {
            sheets.getInfo((err, info) => {
                if (err) return reject(err);

                fn(info, resolve, reject);
            });
        });
    })
}

module.exports.getJobs = index => {
    return gsService((info, resolve, reject) => {
        info.worksheets[index].getRows({}, (err, rows) => {
            if (err) return reject(err);

            const result = rows.map(item => `${item.id} - ${item.title}`).join('\n');
            return resolve(result);
        });
    });
}

module.exports.storeRecord = (obj, index) => {
    return gsService((info, resolve, reject) => {
        const candidateCode = randomatic('0', 6);
        info.worksheets[index].addRow({
            workEx: obj.workEx,
            jobCode: obj.jobCode,
            isAdult: obj.isAdult,
            compScience: obj.compScience,
            relocate: obj.relocate,
            date: new Date().toDateString(),
            candidateCode,
            status: 'Pending'
        }, err => {
            if (err) return reject(err);
            return resolve(candidateCode);
        })
    })
}

module.exports.getApplicationStatus = (candidateCode, index) => {
    return gsService((info, resolve, resject) => {
        info.worksheets[index].getRows({
            query: `candidatecode=${candidateCode}` // the column name in lowercase, this is the convention
        }, (err, rows) => {
            if (err) return reject(err);
            if (rows.length != 0) {
                switch (rows[0].status) {
                    case 'Pending':
                        return resolve("Thank you for you query. We're still awaiting results on your application. Please check back at a later time");
                        break;
                    case 'Shortlisted':
                        return resolve("Congratulations. You've been shortlisted for the next step. Please contact BotHR and quote your application code");
                        break;
                    case 'Rejected':
                        return resolve("Sorry, your application has been rejected at this time.");
                        break;
                    default:
                        {
                            return resolve("We're unable to fetch your application status. Please check back at a later time.")
                        }
                }
            } else {
                return resolve(false);
            }
        });
    })
}