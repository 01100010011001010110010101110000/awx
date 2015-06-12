/* jshint node: true */
/* globals -expect, -_ */

import compareFacts from 'tower/system-tracking/compare-facts/flat';

var expect = require('chai').expect;
var _ = require('lodash');

global._ = _;

describe('CompareFacts.Flat', function() {

    it('returns empty array with empty basis facts', function() {
        var result = compareFacts({ facts: [] }, { facts: [] });

        expect(result).to.deep.equal([]);
    });

    it('returns empty array when no differences', function() {
        var result = compareFacts(
                        {   facts:
                            [{  'name': 'foo',
                                'value': 'bar'
                            }]
                        },
                        {   facts:
                            [{  'name': 'foo',
                                'value': 'bar'
                            }]
                        }, 'name', ['value']);

        expect(result).to.deep.equal([]);
    });

    context('when both collections contain facts', function() {
        it('includes each fact value when a compareKey differs', function() {
            var result = compareFacts(
                            {   position: 'left',
                                facts:
                                [{  'name': 'foo',
                                    'value': 'bar'
                                }]
                            },
                            {   position: 'right',
                                facts:
                                [{  'name': 'foo',
                                    'value': 'baz'
                                }]
                            }, 'name', ['value']);

            expect(result).to.deep.equal(
                [{  displayKeyPath: 'foo',
                    nestingLevel: 0,
                    facts:
                    [{  keyName: 'foo',
                        value1: 'bar',
                        value1IsAbsent: false,
                        value2: 'baz',
                        value2IsAbsent: false
                    }]
                }]);
        });
    });

    context('when value for nameKey is present in one collection but not the other', function() {

        function factData(leftFacts) {
            var facts = [{   position: 'left',
                            facts: leftFacts
                        },
                        {   position: 'right',
                            facts: []
                        }];

            return facts;
        }

        it('uses "absent" for the missing value', function() {

            var facts = factData([{  'name': 'foo'
                                 }]);

            var result = compareFacts(facts[0], facts[1], 'name', ['value']);

            expect(result).to.deep.equal(
                [{  displayKeyPath: 'foo',
                    nestingLevel: 0,
                    facts:
                    [{  keyName: 'name',
                        value1: 'foo',
                        value1IsAbsent: false,
                        value2: 'absent',
                        value2IsAbsent: true
                    }]
                }]);
        });

        it('includes all keys from basisFacts', function() {
            var facts = factData([{  'name': 'foo',
                                     'value': 'bar'
                                 }]);

            var result = compareFacts(facts[0], facts[1], 'name', ['value']);

            expect(result).to.deep.equal(
                [{  displayKeyPath: 'foo',
                    nestingLevel: 0,
                    facts:
                    [{  keyName: 'name',
                        value1: 'foo',
                        value1IsAbsent: false,
                        value2: 'absent',
                        value2IsAbsent: true
                     },
                     {  keyName: 'value',
                        value1: 'bar',
                        value1IsAbsent: false,
                        value2: 'absent',
                        value2IsAbsent: true
                     }]
                }]);

        });

        context('with factTemplate', function() {
            it('does not attempt to render the absent fact', function() {
                var facts = factData([{  'name': 'foo'
                                     }]);

                var renderCallCount = 0;
                var factTemplate =
                    {   render: function() {
                                    renderCallCount++;
                                },
                        template: ""
                    };

                compareFacts(facts[0], facts[1], 'name', ['value'], factTemplate);

                expect(renderCallCount).to.equal(1);

            });
        });
    });

    context('with factTemplate', function() {
        var factData;

        beforeEach(function() {
            factData = [{   position: 'left',
                            facts:
                            [{  'name': 'foo',
                                'value': 'bar'
                            }]
                        },
                        {   position: 'right',
                            facts:
                            [{  'name': 'foo',
                                'value': 'baz'
                            }]
                        }];
        });

        it('renders the template with each provided fact', function() {

            var renderCalledWith = [];
            var factTemplate =
                {   render: function(fact) {
                                renderCalledWith.push(fact);
                            },
                    template: ""
                };

            compareFacts(factData[0], factData[1], 'name', ['value'], factTemplate);

            expect(renderCalledWith).to.include(factData[0].facts[0]);
            expect(renderCalledWith).to.include(factData[1].facts[0]);
        });


    });
});
