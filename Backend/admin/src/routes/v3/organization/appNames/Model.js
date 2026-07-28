const OrgAppWebModel = require('../../../../models/organization_apps_web.schema');
const Common = require('../../../../utils/helpers/Common.js');

const escapeRegExp = (text) => {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * Canonical form of an application or domain name.
 *
 * This is the single point of truth for it. Agent-reported names arrive here
 * via upsert() below, and admin-entered names arrive via the productivity
 * ranking screen — if the two normalised differently, an admin who typed
 * "Microsoft Excel" before rollout would end up with a second, separate entry
 * once the agent reported "microsoft excel", and their classification would
 * appear to do nothing. Both paths must call this.
 *
 * @param {string} name
 * @param {number|string} type 1 = application, 2 = domain
 */
const normalizeActivityName = (name, type) => (
    +type === 1
        ? String(name).toLowerCase().replace('.exe', '').trim()
        : Common.extractHostname(String(name))
);

class Model {
    static search({keyword, type, limit, organization_id}) {
        return Promise.all([
            OrgAppWebModel
                .find(
                    {organization_id, type, $text: {$search: keyword}},
                    {score: {$meta: 'textScore'}, name: 1},
                )
                .lean()
                .sort({score: {$meta: 'textScore'}})
                .limit(limit),
            OrgAppWebModel
                .find(
                    {organization_id, type, name: new RegExp(escapeRegExp(keyword), 'i')},
                    {name: 1},
                )
                .lean()
                .limit(limit)
        ]).then(([result1, result2]) => {
            if (result1.length === limit) return result1;
            return [...result1, ...result2.slice(result1.length, limit - result1.length)];
        }).then(rows => rows.map(row => ({id: row._id, name: row.name})));
    }

    static async upsert({name, type, organization_id}) {
        const preparedName = normalizeActivityName(name, type);
        const {_id: id} = (
            await OrgAppWebModel.findOne({name: preparedName, type, organization_id}).select('_id').lean()
        ) || (
            await new OrgAppWebModel({name: preparedName, type, organization_id}).save()
        );
        return {id, name: preparedName};
    }
}

module.exports.TYPES = {
    '1': 'Application',
    '2': 'Domain',
};
module.exports.normalizeActivityName = normalizeActivityName;
module.exports.Model = Model;
