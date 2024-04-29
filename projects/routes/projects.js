var express = require('express'),
router = express.Router(),
mongoose = require('mongoose'), 
bodyParser = require('body-parser'), 
methodOverride = require('method-override'); 
var Project = mongoose.model('Project');
var ProjectMembers = mongoose.model('ProjectMembers');
var authMiddleware = require('../middleware/auth');
var User = mongoose.model('User');

function formatDate(date) {
    return date ? date.toISOString().substring(0, 10) : '';
}

router.use(bodyParser.urlencoded({ extended: true }))
router.use(methodOverride(function(req, res){
      if (req.body && typeof req.body === 'object' && '_method' in req.body) {
        var method = req.body._method
        delete req.body._method
        return method
      }
}))

/*-----U svim rutama dodana je middleware isLoggedIn funkcija koja provjerava je li korisnik prijavljen u sustav-----*/
/*-----Ako korisnik nije prijavljen u sustav, a pokuša napraviti request na neku rutu, bit će redirectan na login page-----*/

/*-----Kada korisnik klikne na Archived projects, otvara mu se stranica s arhiviranim projektima-----*/
/*-----Arhivirani projekti uključuju projekte na kojima je prijavljeni korisnik vlasnik te projekti na kojima sudjeljuje kao član-----*/
router.get('/projects/archive', authMiddleware.isLoggedIn, async function(req, res, next) {
    try {
        const userId = req.session.userId;

        /*-----Prvo se pronalaze projekti na kojima je prijavljeni korisnik vlasnik projekta-----*/
        const leaderProjects = await Project.find({ projectLeaderId: userId, isArchived: true });

        /*-----Zatim se dohvacaju svi id-ovi projekata iz projectmembers kolekcije koji su pvoezani s id-em prijavljenog korisnika-----*/
        const memberProjectsIds = await ProjectMembers.find({ id_clana: userId }).distinct('id_projekta');

        /*-----Na temelju pronadjenih project id-eva, dohvacaju se svi projekti na kojima je prijavljeni korisnik clan-----*/
        const memberProjects = await Project.find({ _id: { $in: memberProjectsIds }, isArchived: true });

        /*-----Povezivanje obje vrste projekata u archivedProjects-----*/
        const archivedProjects = [...leaderProjects, ...memberProjects];

        // Fetch project leader names
        /*-----Dohvacanje imena leadera projekta preko projectLeaderId atributa iz projects kolekcije-----*/
        const promises = archivedProjects.map(async (project) => {
            const projectLeader = await User.findById(project.projectLeaderId);
            project.projectLeaderName = projectLeader ? `${projectLeader.firstName} ${projectLeader.lastName}` : 'Unknown';
            return project;
        });

        /*-----Čekanje na završetak svih asinkronih operacija te prosljeđivanje projekata u archive view-----*/
        const projectsWithLeaderNames = await Promise.all(promises);

        res.render('projects/archive', { projects: projectsWithLeaderNames });
    } catch (error) {
        next(error);
    }
});

/*-----Kada korisnik klikne na Member projects, otvara mu se stranica s projektima na kojima je dodan kao clan-----*/
router.get('/projects/member', authMiddleware.isLoggedIn, async (req, res, next) => {
    try {
        const userId = req.session.userId;

        /*-----Dohvacanje id-eva projekata iz projectmembers kolekcije koji su povezani s id-em trenutnog korisnika-----*/
        const projectIds = await ProjectMembers.find({ id_clana: userId }).distinct('id_projekta');

        /*-----Dohvacanje svih projekata, koji nisu arhivirani, na temelju dohvacenih id-eva projekata-----*/
        const memberProjects = await Project.find({ _id: { $in: projectIds }, isArchived: false });

        /*-----Dohvacanje svih imena voditelja na projekatima koji ce biti prikazani na member projects stranici-----*/
        const promises = memberProjects.map(async (project) => {
            const projectLeader = await User.findById(project.projectLeaderId);
            project.projectLeaderName = projectLeader ? `${projectLeader.firstName} ${projectLeader.lastName}` : 'Unknown';
            return project;
        });

        /*-----Cekanje na zavrsetak svih asinkronih funkcija te prosljeđivanje memberProjects view-u-----*/
        const memberProjectsWithLeaderNames = await Promise.all(promises);

        res.render('projects/memberprojects', { memberProjects: memberProjectsWithLeaderNames });
    } catch (error) {
        next(error);
    }
});

/*-----Na memberprojects stranici, ako korisnik klikne na edit otvara mu se stranica na kojoj je forma za edit atributa obavljeni poslovi-----*/
router.get('/projects/member/:id/edit', authMiddleware.isLoggedIn, async (req, res, next) => {
    try {
        const projectId = req.params.id;
        const project = await Project.findById(projectId);
        if (!project) {
            req.session.errorMessage = 'Project not found.';
            return res.redirect('/projects/member');
        }
        res.render('projects/memberedit', { project: project });
    } catch (error) {
        next(error);
    }
});

/*-----Kada korisnik izmijeni atribut obavljeni poslovi i klikne save, ažurira se atribut projekta obavljeni poslovi u projects kolekciji-----*/
router.put('/projects/member/:id', authMiddleware.isLoggedIn, async (req, res, next) => {
    try {
        const projectId = req.params.id;
        const { obavljeni_poslovi } = req.body;

        if (!projectId || !obavljeni_poslovi) {
            return res.status(400).json({ error: 'Missing projectId or obavljeni_poslovi in request body.' });
        }

        const updatedProject = await Project.findByIdAndUpdate(projectId, { obavljeni_poslovi: obavljeni_poslovi }, { new: true });

        if (!updatedProject) {
            req.session.errorMessage = 'Project not found.';
            return res.redirect(`/projects/member/${projectId}/edit`);
        }

        const successMessage = 'Project successfully updated.';
        res.render('projects/memberedit', { project: updatedProject, successMessage });
    } catch (error) {
        next(error);
    }
});


/*-----Ruta projects/new vraća new.jade view u kojemu je forma za unos podataka projekta-----*/
/*-----Unutar vecine ruta prosljeđuju se success i error poruke kako bi se korisniku dalo do znanja o rezultatu posta/puta-----*/
router.get('/projects/new', authMiddleware.isLoggedIn, (req, res) => {
    const successMessage = req.session.successMessage;
    const errorMessage = req.session.errorMessage;

    req.session.successMessage = null;
    req.session.errorMessage = null;

    res.render('projects/new', { successMessage, errorMessage });
});

/*-----Kada korisnik klikne na archive, u kolekciji projects se mijenja atribut isArchived na true-----*/
router.put('/projects/archive/:id', authMiddleware.isLoggedIn, async (req, res, next) => {
    try {
        const projectId = req.params.id;

        const updatedProject = await Project.findByIdAndUpdate(projectId, { isArchived: true }, { new: true });

        if (!updatedProject) {
            req.session.errorMessage = 'Project not found.';
            return res.redirect('/projects/myprojects');
        }

        req.session.successMessage = 'Project archived successfully.';
        return res.redirect('/projects/myprojects');
    } catch (error) {
        next(error);
    }
});

/*-----Dohvacanje svih projekata-----*/
router.get('/projects/myprojects',authMiddleware.isLoggedIn, function(req, res, next) {
    const userId = req.session.userId;
    const projectLeaderName = req.session.firstName + ' ' + req.session.lastName;

    const successMessage = req.session.successMessage;
    const errorMessage = req.session.errorMessage;

    req.session.successMessage = null;
    req.session.errorMessage = null;

    /*-----Dohvacaju se svi projekti iz kolekcije projects, nakon cega se traze korisnici koji pripadaju svakom od projekata-----*/
    /*-----Clanovi projekta se nalaze u kolekciji projectmembers unutar koje su spremljeni atributi: id projekta i ime korisnika na projektu-----*/

    Project.find({projectLeaderId: userId})
    .then(projects => {
        const promises = projects.map(project => {
            return ProjectMembers.find({ id_projekta: project._id })
                .populate('id_clana')
                .then(members => {
                    project.members = members;
                    return project;
                });
        });

    /*-----Filtriranje projekata tako da budu samo projekti kojima je isArchived atribut false-----*/
    const nonArchivedProjects = projects.filter(project => !project.isArchived);    

    /*-----Nakon sto se dohvate svi projekti, vrijednosti se prosljeđuju viewu myprojects.jade-----*/
    Promise.all(promises)
            .then(projectsWithMembers => {
                res.render('projects/myprojects', { projects: nonArchivedProjects,projectLeaderName,successMessage, errorMessage });
            })
            .catch(err => {
                next(err);
            });

    
    })
    .catch(err => {
        next(err);
    });
});

/*-----Kada se klikne na edit button, otvara se edit view projekta pronađenog po njegovom id-u-----*/
router.get('/projects/:id/edit',authMiddleware.isLoggedIn, function(req, res, next) {
    const successMessage = req.session.successMessage;
    const errorMessage = req.session.errorMessage;

    req.session.successMessage = null;
    req.session.errorMessage = null;

    Project.findById(req.params.id)
        .then(project => {
            if (!project) {
                return res.status(404).send('Project not found.');
            }
            /*-----View-u se prosljeđuju podaci o projektu kako bi mogle biti prikazane trenutne vrijednosti projekta-----*/
            /*-----Prosljeđuje se i formatDate funkcija kako bi vrijednosti datuma iz kolekcije na input kalendara bile postavljene-----*/
            res.render('projects/edit', { project: project, formatDate });
        })
        .catch(err => {
            next(err);
        });
});

/*-----Dohvacanje projekta na temelju njegovog id-a-----*/
router.get('/projects/:id',authMiddleware.isLoggedIn, function(req, res, next) {
    const projectId = req.params.id;

    const successMessage = req.session.successMessage;
    const errorMessage = req.session.errorMessage;

    req.session.successMessage = null;
    req.session.errorMessage = null;

    /*-----Ako se projekt ne moze naci, izbacuje se error poruka i vraca se na myprojects-----*/
    Project.findById(projectId)
        .then(project => {
            if (!project) {
                req.session.errorMessage = 'Project not found.';
                return res.redirect("/projects/myprojects");
            }
            
            /*-----Ukoliko je projekt pronadjen, vraca se show view s podacima trazenog projekta-----*/
            /*-----Dohvacaju se i clanovi tog projekta jer su u posebnoj kolekciji-----*/
            ProjectMembers.find({ id_projekta: projectId })
                .populate('id_clana')
                .then(projectMembers => {
                    console.log('Project Members:', projectMembers);
                    res.render('projects/show', { project: project, projectMembers: projectMembers, successMessage: successMessage, errorMessage: errorMessage });
                })
                .catch(err => {
                    console.error('Error fetching project members:', err);
                    req.session.errorMessage = 'Failed to fetch project members.';
                    res.redirect("/projects/myprojects");
                });
        })
        .catch(err => {
            console.error('Error fetching project:', err);
            req.session.errorMessage = 'Failed to fetch the project.';
            res.redirect("/projects/myprojects");
        });
});

/*-----Kada se klikne na dodaj projekt, pohranjuju se podaci u projects kolekciju te se ispisuje poruka ovisno o rezultatu operacije-----*/
router.post('/projects', authMiddleware.isLoggedIn,(req, res) => {
    const { naziv_projekta, opis_projekta, cijena_projekta, obavljeni_poslovi, datum_pocetka, datum_zavrsetka } = req.body;
    
    const projectLeaderId = req.session.userId;

    mongoose.model('Project').create({
      naziv_projekta,
      opis_projekta,
      cijena_projekta,
      obavljeni_poslovi,
      datum_pocetka,
      datum_zavrsetka,
      isArchived: false,
      projectLeaderId: projectLeaderId
    })
    .then(createdProject => {
      console.log('New project created:', createdProject);
      req.session.successMessage = 'Projekt je uspješno dodan.';
      res.redirect('/projects/new');
    })
    .catch(error => {
      console.error('Error saving project:', error);
      req.session.errorMessage = error.message;
      res.redirect('/projects/new');
    });
  });

/*-----Kada se klikne na tipku delete, iz kolekcije projects brise se projekt predanog id-a-----*/
router.delete('/projects/:id',authMiddleware.isLoggedIn, function(req, res) {
    Project.findOneAndDelete({ _id: req.params.id })
        .then(project => {
            if (!project) {
                console.error('Project not found.');
                req.session.errorMessage = 'Project not found.';
            } else {
                console.log('DELETE removing ID: ' + project._id);
                req.session.successMessage = 'Project successfully deleted.';
            }
            res.redirect("/projects/myprojects");
        })
        .catch(error => {
            console.error('Error deleting project:', error);
            req.session.errorMessage = 'Failed to delete the project.';
            res.redirect("/projects/myprojects");
        });
});

/*-----Kada korisnik klikne na tipku update, u kolekciji projects azuriraju se-----*/
/*-----vrijednosti koje korisnik zeli izmijeniti određenog projekta-----*/
router.put('/projects/:id',authMiddleware.isLoggedIn, function(req, res) {
    const { naziv_projekta, opis_projekta, cijena_projekta, obavljeni_poslovi, datum_pocetka, datum_zavrsetka } = req.body;

    Project.findByIdAndUpdate(req.params.id, {
        naziv_projekta,
        opis_projekta,
        cijena_projekta,
        obavljeni_poslovi,
        datum_pocetka,
        datum_zavrsetka
    }, { new: true })
        .then(updatedProject => {
            if (!updatedProject) {
                return res.status(404).send('Project not found.');
            }
            res.format({
                html: function(){
                    req.session.successMessage = 'Project successfully updated.';
                    res.redirect("/projects/myprojects");
                },
                json: function(){
                    res.json(updatedProject);
                }
            });
        })
        .catch(error => {
            console.error('Error updating project:', error);
            req.session.errorMessage = 'Failed to update the project.';
            res.redirect("/projects/myprojects");
        });
});

/*-----Kada korisnik klikne na tipku Add Member otvara se forma za dodavanje clana na taj projekt-----*/
router.get('/projects/:id/add', authMiddleware.isLoggedIn, function(req, res) {
    var projectId = req.params.id;
    var projectLeaderId = req.session.userId;

    req.session.errorMessage = null;

    User.find({ _id: { $ne: projectLeaderId } }) 
        .then(users => {
            res.render('projects/add', { projectId: projectId, users: users, errorMessage: req.session.errorMessage });
        })
        .catch(err => {
            console.error('Error fetching users:', err);
            next(err);
        });
});

/*-----Dodavanje clana projektnog tima; potreban je i id projekta kako bi se novi korisnik spremio-----*/
/*-----u kolekciju projectmembers pod tocnim id-em projekta-----*/
router.post('/projects/:id/add', authMiddleware.isLoggedIn, function(req, res) {
    var projectId = req.params.id;
    var userId = req.body.userId;
    var projectLeaderId = req.session.userId;

    var ProjectMembers = mongoose.model('ProjectMembers');

    if (!userId) {
        console.error('User ID is missing in the request.');
        req.session.errorMessage = 'User ID is missing.';
        return res.redirect(`/projects/${projectId}`);
    }
    
    ProjectMembers.findOne({ id_clana: userId, id_projekta: projectId })
        .then(existingMember => {
            if (existingMember) {
                req.session.errorMessage = 'User is already added to the project.';
                // Fetch list of users except the project leader
                User.find({ _id: { $ne: projectLeaderId } })
                    .then(users => {
                        res.render('projects/add', { projectId: projectId, users: users, errorMessage: req.session.errorMessage });
                    })
                    .catch(error => {
                        console.error('Error fetching users:', error);
                        req.session.errorMessage = 'Failed to fetch users.';
                        res.render('projects/add', { projectId: projectId, errorMessage: req.session.errorMessage });
                    });
            } else {
                ProjectMembers.create({
                    id_clana: userId,
                    id_projekta: projectId
                })
                .then(function(member) {
                    console.log('New member added:', member);
                    req.session.successMessage = 'Member successfully added to the project.';
                    req.session.errorMessage = null;
                    res.redirect(`/projects/${projectId}`);
                })
                .catch(function(error) {
                    console.error('Error adding member:', error);
                    req.session.errorMessage = 'Failed to add member to the project.';
                    res.redirect(`/projects/${projectId}`);
                });
            }
        })
        .catch(function(error) {
            console.error('Error checking existing member:', error);
            req.session.errorMessage = 'Failed to check if the user is already added to the project.';
            res.redirect(`/projects/${projectId}`);
        });
});


module.exports = router;