import pytest

from awx.api.versioning import reverse


@pytest.mark.django_db
def test_inventory_source_notification_on_cloud_only(get, post, group_factory, user, notification_template):
    u = user('admin', True)
    g_cloud = group_factory('cloud')
    g_not = group_factory('not_cloud')
    cloud_is = g_cloud.inventory_source
    not_is = g_not.inventory_source
    cloud_is.source = 'ec2'
    cloud_is.save()
    url = reverse('api:inventory_source_notification_templates_any_list', kwargs={'pk': cloud_is.id})
    response = post(url, dict(id=notification_template.id), u)
    assert response.status_code == 204
    url = reverse('api:inventory_source_notification_templates_success_list', kwargs={'pk': not_is.id})
    response = post(url, dict(id=notification_template.id), u)
    assert response.status_code == 400


@pytest.mark.parametrize("role_field,expected_status_code", [
    (None, 403),
    ('admin_role', 200),
    ('update_role', 403),
    ('adhoc_role', 403),
    ('use_role', 403)
])
@pytest.mark.django_db
def test_edit_inventory(put, inventory, alice, role_field, expected_status_code):
    data = { 'organization': inventory.organization.id, 'name': 'New name', 'description': 'Hello world', }
    if role_field:
        getattr(inventory, role_field).members.add(alice)
    put(reverse('api:inventory_detail', kwargs={'pk': inventory.id}), data, alice, expect=expected_status_code)


@pytest.mark.parametrize('order_by', ('script', '-script', 'script,pk', '-script,pk'))
@pytest.mark.django_db
def test_list_cannot_order_by_unsearchable_field(get, organization, alice, order_by):
    for i, script in enumerate(('#!/bin/a', '#!/bin/b', '#!/bin/c')):
        custom_script = organization.custom_inventory_scripts.create(
            name="I%d" % i,
            script=script
        )
        custom_script.admin_role.members.add(alice)

    response = get(reverse('api:inventory_script_list'), alice,
                   QUERY_STRING='order_by=%s' % order_by, status=400)
    assert response.status_code == 400


@pytest.mark.parametrize("role_field,expected_status_code", [
    (None, 403),
    ('admin_role', 201),
    ('update_role', 403),
    ('adhoc_role', 403),
    ('use_role', 403)
])
@pytest.mark.django_db
def test_create_inventory_group(post, inventory, alice, role_field, expected_status_code):
    data = { 'name': 'New name', 'description': 'Hello world', }
    if role_field:
        getattr(inventory, role_field).members.add(alice)
    post(reverse('api:inventory_groups_list', kwargs={'pk': inventory.id}), data, alice, expect=expected_status_code)


@pytest.mark.parametrize("role_field,expected_status_code", [
    (None, 403),
    ('admin_role', 201),
    ('update_role', 403),
    ('adhoc_role', 403),
    ('use_role', 403)
])
@pytest.mark.django_db
def test_create_inventory_group_child(post, group, alice, role_field, expected_status_code):
    data = { 'name': 'New name', 'description': 'Hello world', }
    if role_field:
        getattr(group.inventory, role_field).members.add(alice)
    post(reverse('api:group_children_list', kwargs={'pk': group.id}), data, alice, expect=expected_status_code)


@pytest.mark.parametrize("role_field,expected_status_code", [
    (None, 403),
    ('admin_role', 200),
    ('update_role', 403),
    ('adhoc_role', 403),
    ('use_role', 403)
])
@pytest.mark.django_db
def test_edit_inventory_group(put, group, alice, role_field, expected_status_code):
    data = { 'name': 'New name', 'description': 'Hello world', }
    if role_field:
        getattr(group.inventory, role_field).members.add(alice)
    put(reverse('api:group_detail', kwargs={'pk': group.id}), data, alice, expect=expected_status_code)


@pytest.mark.parametrize("role_field,expected_status_code", [
    (None, 403),
    ('admin_role', 204),
    ('update_role', 403),
    ('adhoc_role', 403),
    ('use_role', 403)
])
@pytest.mark.django_db
def test_delete_inventory_group(delete, group, alice, role_field, expected_status_code):
    if role_field:
        getattr(group.inventory, role_field).members.add(alice)
    delete(reverse('api:group_detail', kwargs={'pk': group.id}), alice, expect=expected_status_code)


@pytest.mark.parametrize("role_field,expected_status_code", [
    (None, 403),
    ('admin_role', 201),
    ('update_role', 403),
    ('adhoc_role', 403),
    ('use_role', 403)
])
@pytest.mark.django_db
def test_create_inventory_host(post, inventory, alice, role_field, expected_status_code):
    data = { 'name': 'New name', 'description': 'Hello world', }
    if role_field:
        getattr(inventory, role_field).members.add(alice)
    post(reverse('api:inventory_hosts_list', kwargs={'pk': inventory.id}), data, alice, expect=expected_status_code)


@pytest.mark.parametrize("role_field,expected_status_code", [
    (None, 403),
    ('admin_role', 201),
    ('update_role', 403),
    ('adhoc_role', 403),
    ('use_role', 403)
])
@pytest.mark.django_db
def test_create_inventory_group_host(post, group, alice, role_field, expected_status_code):
    data = { 'name': 'New name', 'description': 'Hello world', }
    if role_field:
        getattr(group.inventory, role_field).members.add(alice)
    post(reverse('api:group_hosts_list', kwargs={'pk': group.id}), data, alice, expect=expected_status_code)


@pytest.mark.parametrize("role_field,expected_status_code", [
    (None, 403),
    ('admin_role', 200),
    ('update_role', 403),
    ('adhoc_role', 403),
    ('use_role', 403)
])
@pytest.mark.django_db
def test_edit_inventory_host(put, host, alice, role_field, expected_status_code):
    data = { 'name': 'New name', 'description': 'Hello world', }
    if role_field:
        getattr(host.inventory, role_field).members.add(alice)
    put(reverse('api:host_detail', kwargs={'pk': host.id}), data, alice, expect=expected_status_code)


@pytest.mark.parametrize("role_field,expected_status_code", [
    (None, 403),
    ('admin_role', 204),
    ('update_role', 403),
    ('adhoc_role', 403),
    ('use_role', 403)
])
@pytest.mark.django_db
def test_delete_inventory_host(delete, host, alice, role_field, expected_status_code):
    if role_field:
        getattr(host.inventory, role_field).members.add(alice)
    delete(reverse('api:host_detail', kwargs={'pk': host.id}), alice, expect=expected_status_code)


@pytest.mark.parametrize("role_field,expected_status_code", [
    (None, 403),
    ('admin_role', 202),
    ('update_role', 202),
    ('adhoc_role', 403),
    ('use_role', 403)
])
@pytest.mark.django_db
def test_inventory_source_update(post, inventory_source, alice, role_field, expected_status_code):
    if role_field:
        getattr(inventory_source.group.inventory, role_field).members.add(alice)
    post(reverse('api:inventory_source_update_view', kwargs={'pk': inventory_source.id}), {}, alice, expect=expected_status_code)
