import Ansi from 'ansi-to-html';
import hasAnsi from 'has-ansi';

let vm;
let ansi;
let job;
let jobEvent;
let container;
let $timeout;
let $sce;
let $compile;
let $scope;

const record = {};
const meta = {
    scroll: {}
};

const ROW_LIMIT = 200;
const SCROLL_BUFFER = 250;
const SCROLL_LOAD_DELAY = 100;
const EVENT_START_TASK = 'playbook_on_task_start';
const EVENT_START_PLAY = 'playbook_on_play_start';
const EVENT_STATS_PLAY = 'playbook_on_stats';
const ELEMENT_TBODY = '#atStdoutResultTable';
const ELEMENT_CONTAINER = '.at-Stdout-container';

const EVENT_GROUPS = [
    EVENT_START_TASK,
    EVENT_START_PLAY
];

const TIME_EVENTS = [
    EVENT_START_TASK,
    EVENT_START_PLAY,
    EVENT_STATS_PLAY
];

function JobsIndexController (_job_, JobEventModel, _$sce_, _$timeout_, _$scope_, _$compile_) {
    $timeout = _$timeout_;
    $sce = _$sce_;
    $compile = _$compile_;
    $scope = _$scope_;
    job = _job_;

    ansi = new Ansi();
    jobEvent = new JobEventModel();

    const events = job.get('related.job_events.results');
    const html = $sce.trustAsHtml(parseEvents(events));

    vm = this || {};

    $scope.ns = 'jobs';
    $scope.jobs = {
        modal: {}
    };

    vm.toggle = toggle;
    vm.showHostDetails = showHostDetails;

    vm.menu = {
        scroll: {
            display: false,
            to: scrollTo
        },
        top: {
            expand,
            isExpanded: true
        },
        bottom: {
            next
        }
    };

    $timeout(() => {
        const table = $(ELEMENT_TBODY);
        container = $(ELEMENT_CONTAINER);

        table.html($sce.getTrustedHtml(html));
        $compile(table.contents())($scope);

        meta.next = job.get('related.job_events.next');
        meta.prev = job.get('related.job_events.previous');
        meta.cursor = job.get('related.job_events.results').length;

        container.scroll(onScroll);
    });
}

function next () {
    const config = {
        related: 'job_events',
        params: {
            order_by: 'start_line'
        }
    };

    job.next(config)
        .then(cursor => {
            meta.next = job.get('related.job_events.next');
            meta.prev = job.get('related.job_events.previous');

            console.log(ROW_LIMIT);
            console.log(getRowCount());
            console.log(getRowsInView());
            console.log(getScrollPosition());

            console.log('above:', getRowsAbove());
            console.log('below:', getRowsBelow());
            append(cursor);
            shift();

            debugger;
        });
}

function prev () {
    job.prev({ related: 'job_events' })
        .then(cursor => {
            console.log(cursor);
        });
}

function getRowCount () {
    return $(ELEMENT_TBODY).children().length;
}

function getRowHeight () {
    return $(ELEMENT_TBODY).children()[0].offsetHeight;
}

function getViewHeight () {
    return $(ELEMENT_CONTAINER)[0].offsetHeight;
}

function getScrollPosition () {
    return $(ELEMENT_CONTAINER)[0].scrollTop;
}

function getScrollHeight () {
    return $(ELEMENT_CONTAINER)[0].scrollHeight;
}

function getRowsAbove () {
    const top = getScrollPosition();

    if (top === 0) {
        return 0;
    }

    return Math.floor(top / getRowHeight());
}

function getRowsBelow () {
    const bottom = getScrollPosition() + getViewHeight();

    return Math.floor((getScrollHeight() - bottom) / getRowHeight());
}

function getRowsInView () {
    const rowHeight = getRowHeight();
    const viewHeight = getViewHeight();

    return Math.floor(viewHeight / rowHeight);
}

function append (cursor) {
    const events = job.get('related.job_events.results').slice(cursor);
    const rows = $($sce.getTrustedHtml($sce.trustAsHtml(parseEvents(events))));
    const table = $(ELEMENT_TBODY);

    table.append(rows);
    $compile(rows.contents())($scope);
}

/*
 *function prepend (cursor) {
 *
 *}
 *
 */
function shift () {
    const count = getRowCount() - ROW_LIMIT;
    const rows = $(ELEMENT_TBODY).children().slice(0, count);

    console.log(count, rows);

    rows.empty();
    rows.remove();
}

function expand () {
    vm.toggle(meta.parent, true);
}

function scrollTo (direction) {
    if (direction === 'top') {
        container[0].scrollTop = 0;
    } else {
        container[0].scrollTop = container[0].scrollHeight;
    }
}

function parseEvents (events) {
    events.sort(orderByLineNumber);

    return events.reduce((html, event) => `${html}${parseLine(event)}`, '');
}

function orderByLineNumber (a, b) {
    if (a.start_line > b.start_line) {
        return 1;
    }

    if (a.start_line < b.start_line) {
        return -1;
    }

    return 0;
}

function parseLine (event) {
    if (!event || !event.stdout) {
        return '';
    }

    const { stdout } = event;
    const lines = stdout.split('\r\n');

    let ln = event.start_line;

    const current = createRecord(ln, lines, event);

    return lines.reduce((html, line, i) => {
        ln++;

        const isLastLine = i === lines.length - 1;
        let row = createRow(current, ln, line);

        if (current && current.isTruncated && isLastLine) {
            row += createRow(current);
        }

        return `${html}${row}`;
    }, '');
}

function createRecord (ln, lines, event) {
    if (!event.uuid) {
        return null;
    }

    const info = {
        id: event.id,
        line: ln + 1,
        uuid: event.uuid,
        level: event.event_level,
        start: event.start_line,
        end: event.end_line,
        isTruncated: (event.end_line - event.start_line) > lines.length,
        isHost: typeof event.host === 'number'
    };

    if (event.parent_uuid) {
        info.parents = getParentEvents(event.parent_uuid);
    }

    if (info.isTruncated) {
        info.truncatedAt = event.start_line + lines.length;
    }

    if (EVENT_GROUPS.includes(event.event)) {
        info.isParent = true;

        if (event.event_level === 1) {
            meta.parent = event.uuid;
        }

        if (event.parent_uuid) {
            if (record[event.parent_uuid]) {
                if (record[event.parent_uuid].children &&
                    !record[event.parent_uuid].children.includes(event.uuid)) {
                    record[event.parent_uuid].children.push(event.uuid);
                } else {
                    record[event.parent_uuid].children = [event.uuid];
                }
            }
        }
    }

    if (TIME_EVENTS.includes(event.event)) {
        info.time = getTime(event.created);
        info.line++;
    }

    record[event.uuid] = info;

    return info;
}

function getParentEvents (uuid, list) {
    list = list || [];

    if (record[uuid]) {
        list.push(uuid);

        if (record[uuid].parents) {
            list = list.concat(record[uuid].parents);
        }
    }

    return list;
}

function createRow (current, ln, content) {
    let id = '';
    let timestamp = '';
    let tdToggle = '';
    let tdEvent = '';
    let classList = '';

    content = content || '';

    if (hasAnsi(content)) {
        content = ansi.toHtml(content);
    }

    if (current) {
        if (current.isParent && current.line === ln) {
            id = current.uuid;
            tdToggle = `<td class="at-Stdout-toggle" ng-click="vm.toggle('${id}')"><i class="fa fa-angle-down can-toggle"></i></td>`;
        }

        if (current.isHost) {
            tdEvent = `<td class="at-Stdout-event--host" ng-click="vm.showHostDetails('${current.id}')">${content}</td>`;
        }

        if (current.time && current.line === ln) {
            timestamp = `<span>${current.time}</span>`;
        }

        if (current.parents) {
            classList = current.parents.reduce((list, uuid) => `${list} child-of-${uuid}`, '');
        }
    }

    if (!tdEvent) {
        tdEvent = `<td class="at-Stdout-event">${content}</td>`;
    }

    if (!tdToggle) {
        tdToggle = '<td class="at-Stdout-toggle"></td>';
    }

    if (!ln) {
        ln = '...';
    }

    return `
        <tr id="${id}" class="${classList}">
            ${tdToggle}
            <td class="at-Stdout-line">${ln}</td>
            ${tdEvent}
            <td class="at-Stdout-time">${timestamp}</td>
        </tr>`;
}

function getTime (created) {
    const date = new Date(created);
    const hour = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
    const minute = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
    const second = date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds();

    return `${hour}:${minute}:${second}`;
}

function showHostDetails (id) {
    jobEvent.request('get', id)
        .then(() => {
            const title = jobEvent.get('host_name');

            vm.host = {
                menu: true,
                stdout: jobEvent.get('stdout')
            };

            $scope.jobs.modal.show(title);
        });
}

function toggle (uuid, menu) {
    const lines = $(`.child-of-${uuid}`);
    let icon = $(`#${uuid} .at-Stdout-toggle > i`);

    if (menu || record[uuid].level === 1) {
        vm.menu.top.isExpanded = !vm.menu.top.isExpanded;
    }

    if (record[uuid].children) {
        icon = icon.add($(`#${record[uuid].children.join(', #')}`).find('.at-Stdout-toggle > i'));
    }

    if (icon.hasClass('fa-angle-down')) {
        icon.addClass('fa-angle-right');
        icon.removeClass('fa-angle-down');

        lines.addClass('hidden');
    } else {
        icon.addClass('fa-angle-down');
        icon.removeClass('fa-angle-right');

        lines.removeClass('hidden');
    }
}

function onScroll () {
    if (meta.scroll.inProgress) {
        return;
    }

    meta.scroll.inProgress = true;

    $timeout(() => {
        const top = container[0].scrollTop;
        const bottom = top + SCROLL_BUFFER + container[0].offsetHeight;

        meta.scroll.inProgress = false;

        if (top === 0) {
            vm.menu.scroll.display = false;

            prev();

            return;
        }

        vm.menu.scroll.display = true;

        if (bottom >= container[0].scrollHeight && meta.next) {
            next();
        }
    }, SCROLL_LOAD_DELAY);
}

JobsIndexController.$inject = ['job', 'JobEventModel', '$sce', '$timeout', '$scope', '$compile'];

module.exports = JobsIndexController;
