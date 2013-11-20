from django.conf import settings
from django.contrib.auth.models import User
from django.db.models.signals import pre_save, post_save
from django.utils.functional import curry
from awx.main.models import ActivityStream, AuthToken
import json
import uuid
import urllib2

class ActivityStreamMiddleware(object):

    def process_request(self, request):
        self.isActivityStreamEvent = False
        if hasattr(request, 'user') and hasattr(request.user, 'is_authenticated') and request.user.is_authenticated():
            user = request.user
        else:
            user = None

        self.instances = []
        self.cached_user = None
        set_actor = curry(self.set_actor, user)
        self.disp_uid = str(uuid.uuid1())
        self.finished = False
        post_save.connect(set_actor, sender=ActivityStream, dispatch_uid=self.disp_uid, weak=False)

    def process_response(self, request, response):
        drf_request = getattr(request, 'drf_request', None)
        drf_user = getattr(drf_request, 'user', None)
        post_save.disconnect(dispatch_uid=self.disp_uid)
        self.finished = True
        if self.isActivityStreamEvent:
            for instance in self.instances:
                if drf_user is not None:
                    instance.user = drf_user
                    instance.save()
                else:
                    obj1_type_actual = instance.object1_type.split(".")[-1]
                    if obj1_type_actual in ("InventoryUpdate", "ProjectUpdate", "JobEvent", "Job") and instance.id is not None:
                        instance.delete()
        return response

    def set_actor(self, user, sender, instance, **kwargs):
        if not self.finished:
            if sender == ActivityStream:
                if isinstance(user, User) and instance.user is None:
                    instance.user = user
                else:
                    if instance not in self.instances:
                        self.isActivityStreamEvent = True
                        self.instances.append(instance)
            else:
                self.isActivityStreamEvent = False
