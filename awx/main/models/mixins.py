# Python
import json

# Django
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User # noqa

# AWX
from awx.main.models.rbac import (
    Role, RoleAncestorEntry, get_roles_on_resource
)
from awx.main.utils import parse_yaml_or_json
from awx.main.fields import JSONField


__all__ = ['ResourceMixin', 'SurveyJobTemplateMixin', 'SurveyJobMixin']


class ResourceMixin(models.Model):

    class Meta:
        abstract = True

    @classmethod
    def accessible_objects(cls, accessor, role_field):
        '''
        Use instead of `MyModel.objects` when you want to only consider
        resources that a user has specific permissions for. For example:

        MyModel.accessible_objects(user, 'read_role').filter(name__istartswith='bar');

        NOTE: This should only be used for list type things. If you have a
        specific resource you want to check permissions on, it is more
        performant to resolve the resource in question then call
        `myresource.get_permissions(user)`.
        '''
        return ResourceMixin._accessible_objects(cls, accessor, role_field)

    @classmethod
    def accessible_pk_qs(cls, accessor, role_field):
        return ResourceMixin._accessible_pk_qs(cls, accessor, role_field)

    @staticmethod
    def _accessible_pk_qs(cls, accessor, role_field, content_types=None):
        if type(accessor) == User:
            ancestor_roles = accessor.roles.all()
        elif type(accessor) == Role:
            ancestor_roles = [accessor]
        else:
            accessor_type = ContentType.objects.get_for_model(accessor)
            ancestor_roles = Role.objects.filter(content_type__pk=accessor_type.id,
                                                 object_id=accessor.id)

        if content_types is None:
            ct_kwarg = dict(content_type_id = ContentType.objects.get_for_model(cls).id)
        else:
            ct_kwarg = dict(content_type_id__in = content_types)

        return RoleAncestorEntry.objects.filter(
            ancestor__in = ancestor_roles,
            role_field = role_field,
            **ct_kwarg
        ).values_list('object_id').distinct()


    @staticmethod
    def _accessible_objects(cls, accessor, role_field):
        return cls.objects.filter(pk__in = ResourceMixin._accessible_pk_qs(cls, accessor, role_field))


    def get_permissions(self, accessor):
        '''
        Returns a string list of the roles a accessor has for a given resource.
        An accessor can be either a User, Role, or an arbitrary resource that
        contains one or more Roles associated with it.
        '''

        return get_roles_on_resource(self, accessor)


class SurveyJobTemplateMixin(models.Model):
    class Meta:
        abstract = True

    survey_enabled = models.BooleanField(
        default=False,
    )
    survey_spec = JSONField(
        blank=True,
        default={},
    )

    def survey_password_variables(self):
        vars = []
        if self.survey_enabled and 'spec' in self.survey_spec:
            # Get variables that are type password
            for survey_element in self.survey_spec['spec']:
                if survey_element['type'] == 'password':
                    vars.append(survey_element['variable'])
        return vars

    @property
    def variables_needed_to_start(self):
        vars = []
        if self.survey_enabled and 'spec' in self.survey_spec:
            for survey_element in self.survey_spec['spec']:
                if survey_element['required']:
                    vars.append(survey_element['variable'])
        return vars

    def _update_unified_job_kwargs(self, **kwargs):
        '''
        Combine extra_vars with variable precedence order:
          JT extra_vars -> JT survey defaults -> runtime extra_vars
        '''
        # Job Template extra_vars
        extra_vars = self.extra_vars_dict

        # transform to dict
        if 'extra_vars' in kwargs:
            kwargs_extra_vars = kwargs['extra_vars']
            kwargs_extra_vars = parse_yaml_or_json(kwargs_extra_vars)
        else:
            kwargs_extra_vars = {}

        # Overwrite with job template extra vars with survey default vars
        if self.survey_enabled and 'spec' in self.survey_spec:
            for survey_element in self.survey_spec.get("spec", []):
                default = survey_element['default']
                variable_key = survey_element['variable']
                if survey_element.get('type') == 'password':
                    if variable_key in kwargs_extra_vars:
                        kw_value = kwargs_extra_vars[variable_key]
                        if kw_value.startswith('$encrypted$') and kw_value != default:
                            kwargs_extra_vars[variable_key] = default
                extra_vars[variable_key] = default

        # Overwrite job template extra vars with explicit job extra vars
        # and add on job extra vars
        extra_vars.update(kwargs_extra_vars)
        kwargs['extra_vars'] = json.dumps(extra_vars)
        return kwargs

    def survey_variable_validation(self, data):
        errors = []
        if not self.survey_enabled:
            return errors
        if 'name' not in self.survey_spec:
            errors.append("'name' missing from survey spec.")
        if 'description' not in self.survey_spec:
            errors.append("'description' missing from survey spec.")
        for survey_element in self.survey_spec.get("spec", []):
            if survey_element['variable'] not in data and \
               survey_element['required']:
                errors.append("'%s' value missing" % survey_element['variable'])
            elif survey_element['type'] in ["textarea", "text", "password"]:
                if survey_element['variable'] in data:
                    if type(data[survey_element['variable']]) not in (str, unicode):
                        errors.append("Value %s for '%s' expected to be a string." % (data[survey_element['variable']],
                                                                                      survey_element['variable']))
                        continue
                    if 'min' in survey_element and survey_element['min'] not in ["", None] and len(data[survey_element['variable']]) < int(survey_element['min']):
                        errors.append("'%s' value %s is too small (length is %s must be at least %s)." %
                                      (survey_element['variable'], data[survey_element['variable']], len(data[survey_element['variable']]), survey_element['min']))
                    if 'max' in survey_element and survey_element['max'] not in ["", None] and len(data[survey_element['variable']]) > int(survey_element['max']):
                        errors.append("'%s' value %s is too large (must be no more than %s)." %
                                      (survey_element['variable'], data[survey_element['variable']], survey_element['max']))
            elif survey_element['type'] == 'integer':
                if survey_element['variable'] in data:
                    if type(data[survey_element['variable']]) != int:
                        errors.append("Value %s for '%s' expected to be an integer." % (data[survey_element['variable']],
                                                                                        survey_element['variable']))
                        continue
                    if 'min' in survey_element and survey_element['min'] not in ["", None] and survey_element['variable'] in data and \
                       data[survey_element['variable']] < int(survey_element['min']):
                        errors.append("'%s' value %s is too small (must be at least %s)." %
                                      (survey_element['variable'], data[survey_element['variable']], survey_element['min']))
                    if 'max' in survey_element and survey_element['max'] not in ["", None] and survey_element['variable'] in data and \
                       data[survey_element['variable']] > int(survey_element['max']):
                        errors.append("'%s' value %s is too large (must be no more than %s)." %
                                      (survey_element['variable'], data[survey_element['variable']], survey_element['max']))
            elif survey_element['type'] == 'float':
                if survey_element['variable'] in data:
                    if type(data[survey_element['variable']]) not in (float, int):
                        errors.append("Value %s for '%s' expected to be a numeric type." % (data[survey_element['variable']],
                                                                                            survey_element['variable']))
                        continue
                    if 'min' in survey_element and survey_element['min'] not in ["", None] and data[survey_element['variable']] < float(survey_element['min']):
                        errors.append("'%s' value %s is too small (must be at least %s)." %
                                      (survey_element['variable'], data[survey_element['variable']], survey_element['min']))
                    if 'max' in survey_element and survey_element['max'] not in ["", None] and data[survey_element['variable']] > float(survey_element['max']):
                        errors.append("'%s' value %s is too large (must be no more than %s)." %
                                      (survey_element['variable'], data[survey_element['variable']], survey_element['max']))
            elif survey_element['type'] == 'multiselect':
                if survey_element['variable'] in data:
                    if type(data[survey_element['variable']]) != list:
                        errors.append("'%s' value is expected to be a list." % survey_element['variable'])
                    else:
                        for val in data[survey_element['variable']]:
                            if val not in survey_element['choices']:
                                errors.append("Value %s for '%s' expected to be one of %s." % (val, survey_element['variable'],
                                                                                               survey_element['choices']))
            elif survey_element['type'] == 'multiplechoice':
                if survey_element['variable'] in data:
                    if data[survey_element['variable']] not in survey_element['choices']:
                        errors.append("Value %s for '%s' expected to be one of %s." % (data[survey_element['variable']],
                                                                                       survey_element['variable'],
                                                                                       survey_element['choices']))
        return errors


class SurveyJobMixin(models.Model):
    class Meta:
        abstract = True

    survey_passwords = JSONField(
        blank=True,
        default={},
        editable=False,
    )

    def display_extra_vars(self):
        '''
        Hides fields marked as passwords in survey.
        '''
        if self.survey_passwords:
            extra_vars = json.loads(self.extra_vars)
            for key, value in self.survey_passwords.items():
                if key in extra_vars:
                    extra_vars[key] = value
            return json.dumps(extra_vars)
        else:
            return self.extra_vars
