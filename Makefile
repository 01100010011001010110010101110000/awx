PYTHON=python
SITELIB=$(shell $(PYTHON) -c "from distutils.sysconfig import get_python_lib; print get_python_lib()")
RELEASE=ansibleworks-1.2b2

.PHONY: clean rebase push setup requirements requirements_pypi develop refresh \
	adduser syncdb migrate dbchange dbshell runserver celeryd test \
	test_coverage coverage_html dev_build release_build release_ball \
	release_clean sdist rpm

# Remove temporary build files, compiled Python files.
clean:
	rm -rf build rpm-build *.egg-info
	find . -type f -regex ".*\.py[co]$$" -delete

# Fetch from origin, rebase local commits on top of origin commits.
rebase:
	git pull --rebase origin master

# Push changes to origin.
push:
	git push origin master

# Use Ansible to setup AnsibleWorks development environment.
setup:
	ansible-playbook app_setup/setup.yml --verbose -i "127.0.0.1," -c local -e working_dir=`pwd`

# Install third-party requirements needed for development environment (using
# locally downloaded packages).
requirements:
	(cd requirements && pip install --no-index -r dev_local.txt)

# Install third-party requirements needed for development environment
# (downloading from PyPI if necessary).
requirements_pypi:
	pip install -r requirements/dev.txt

# "Install" ansibleworks package in development mode.  Creates link to working
# copy in site-packages and installs ansibleworks-manage command.
develop:
	python setup.py develop

# Refresh development environment after pulling new code.
refresh: clean requirements develop migrate

# Create Django superuser.
adduser:
	python manage.py createsuperuser

# Create initial database tables (excluding migrations).
syncdb:
	python manage.py syncdb --noinput

# Create database tables and apply any new migrations.
# The first command fixes migrations following cleanup for the 1.2b1 release.
migrate: syncdb
	-(python manage.py migrate main 2>&1 | grep 0017_changes) && (python manage.py migrate main --delete-ghost-migrations --fake 0001_v12b1_initial || python manage.py migrate main --fake)
	python manage.py migrate --noinput

# Run after making changes to the models to create a new migration.
dbchange:
	python manage.py schemamigration main v12b2_changes --auto

# access database shell
# asks for password # PYTHON_PATH=./acom python acom/manage.py dbshell
dbshell:
	sudo -u postgres psql -d acom

# Run the built-in development webserver (by default on http://localhost:8013).
runserver:
	python manage.py runserver

# Run to start the background celery worker for development.
celeryd:
	python manage.py celeryd -l DEBUG -B --autoreload

# Run all unit tests.
test:
	python manage.py test main

# Run all unit tests with coverage enabled.
test_coverage:
	coverage run manage.py test main

# Output test coverage as HTML (into htmlcov directory).
coverage_html:
	coverage html

# Build a pip-installable package into dist/ with a timestamped version number.
dev_build:
	python setup.py dev_build

# Build a pip-installable package into dist/ with the release version number.
release_build:
	python setup.py release_build

release_ball: clean 
	make release_build
	(cd ../ansible-doc; make)
	-(rm -rf $(RELEASE))
	mkdir -p $(RELEASE)/dist
	cp -a dist/* $(RELEASE)/dist
	mkdir -p $(RELEASE)/setup
	cp -a setup/* $(RELEASE)/setup
	mkdir -p $(RELEASE)/docs
	cp -a ../ansible-doc/*.pdf $(RELEASE)/docs
	tar -cvf $(RELEASE)-all.tar $(RELEASE)

release_clean:
	-(rm *.tar)
	-(rm -rf ($RELEASE))

sdist: clean
	$(PYTHON) setup.py release_build

rpm: sdist
	@mkdir -p rpm-build
	@cp dist/*.gz rpm-build/
	@rpmbuild --define "_topdir %(pwd)/rpm-build" \
	--define "_builddir %{_topdir}" \
	--define "_rpmdir %{_topdir}" \
	--define "_srcrpmdir %{_topdir}" \
	--define "_specdir %{_topdir}" \
	--define '_rpmfilename %%{NAME}-%%{VERSION}-%%{RELEASE}.%%{ARCH}.rpm' \
	--define "_sourcedir  %{_topdir}" \
	-ba packaging/rpm/ansibleworks.spec

