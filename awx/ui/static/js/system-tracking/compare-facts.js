/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

import compareNestedFacts from './compare-facts/nested';
import compareFlatFacts from './compare-facts/flat';
import FactTemplate from './compare-facts/fact-template';

export function compareFacts(module, facts) {
    // If the module has a template or includes a list of keys to display,
    // then perform a flat comparison, otherwise assume nested
    //
    if (module.factTemplate || module.nameKey) {
        // For flat structures we compare left-to-right, then right-to-left to
        // make sure we get a good comparison between both hosts
        var compare = _.partialRight(compareFlatFacts,
                                     module.nameKey,
                                     module.compareKey,
                                     new FactTemplate(module.factTemplate));

        var leftToRight = compare(facts[0], facts[1]);
        var rightToLeft = compare(facts[1], facts[0]);

        return _(leftToRight)
                    .concat(rightToLeft)
                    .unique('displayKeyPath')
                    .thru(function(result) {
                        return  {   factData: result,
                                    isNestedDisplay: _.isUndefined(module.factTemplate)
                                };
                    })
                    .value();
    } else {
        return {    factData: compareNestedFacts(facts),
                    isNestedDisplay: true
               };
    }
}
