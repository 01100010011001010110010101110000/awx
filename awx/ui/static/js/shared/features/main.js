import awFeatureDirective from 'tower/shared/features/features.directive';
import FeaturesService from 'tower/shared/features/features.service';
export default
    angular.module('features', [])
        .directive('awFeature', awFeatureDirective)
        .service('FeaturesService', FeaturesService);
