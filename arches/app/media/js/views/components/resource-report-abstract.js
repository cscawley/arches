define([
    'arches',
    'jquery',
    'underscore',
    'knockout',
    'report-templates',
    'models/report',
    'models/graph'
], function(arches, $, _, ko, reportLookup, ReportModel, GraphModel) {
    /* CardViewModel is not always available as a dependency on load. So let's get it explicitly */ 
    var CardViewModel;
    require(['viewmodels/card'], function(cardViewModel) { CardViewModel = cardViewModel; });
    
    var ResourceReportAbstract = function(params) {
        var self = this;

        this.loading = ko.observable(true);

        this.version = arches.version;
        this.resourceid = ko.unwrap(params.resourceid);

        this.summary = Boolean(params.summary);
        this.configForm = params.configForm;
        this.configType = params.configType;

        this.template = ko.observable();
        this.report = ko.observable();

        this.initialize = function() {
            if (params.report) {
                if (!params.report.report_json && params.report.attributes.resourceid) {
                    var url = arches.urls.api_bulk_disambiguated_resource_instance + `?resource_ids=${params.report.attributes.resourceid}`;
    
                    $.getJSON(url, function(resp) {
                        params.report.report_json = resp[params.report.attributes.resourceid];
    
                        self.template(reportLookup[params.report.templateId()]);
                        self.report(params.report);
                        self.loading(false);
                    })
                }
                else {
                    this.template(reportLookup[params.report.templateId()]);
                    this.report(params.report);
    
                    self.loading(false);
                }
            } 
            else if (self.resourceid) {
                var url = arches.urls.api_resource_report(self.resourceid);

                self.fetchResourceData(url).then(function(responseJson) {
                    var template = responseJson.template;
                    self.template(template);
                    
                    if (template.preload_resource_data) {
                        self.preloadResourceData(responseJson)
                    }
                    else {
                        self.report({
                            'template': responseJson.template,
                            'report_json': responseJson.report_json,
                        });
                    }
        
                    self.loading(false);
                });

            }
        };

        this.fetchResourceData = function(url) {
            return window.fetch(url).then(function(response){
                if (response.ok) {
                    return response.json();
                }
                else {
                    throw new Error(arches.translations.reNetworkReponseError);
                }
            });
        };
        
        this.preloadResourceData = function(responseJson) {
            var graphModel = new GraphModel({
                data: responseJson.graph,
                datatypes: responseJson.datatypes,
            });

            graph = {
                graphModel: graphModel,
                cards: responseJson.cards,
                graph: responseJson.graph,
                datatypes: responseJson.datatypes,
                cardwidgets: responseJson.cardwidgets
            };

            responseJson.cards = _.filter(graph.cards, function(card) {
                var nodegroup = _.find(graph.graph.nodegroups, function(group) {
                    return group.nodegroupid === card.nodegroup_id;
                });
                return !nodegroup || !nodegroup.parentnodegroup_id;
            }).map(function(card) {
                return new CardViewModel({
                    card: card,
                    graphModel: graph.graphModel,
                    resourceId: self.resourceid,
                    displayname: responseJson.displayname,
                    cards: graph.cards,
                    tiles: responseJson.tiles,
                    cardwidgets: graph.cardwidgets
                });
            });

            var report = new ReportModel(_.extend(responseJson, {
                resourceid: self.resourceid,
                graphModel: graph.graphModel,
                graph: graph.graph,
                datatypes: graph.datatypes
            }));

            report['hideEmptyNodes'] = responseJson.hide_empty_nodes;
            report['report_json'] = responseJson.report_json;

            self.report(report);
        };

        this.initialize();
    };
    ko.components.register('resource-report-abstract', {
        viewModel: ResourceReportAbstract,
        template: { require: 'text!templates/views/components/resource-report-abstract.htm' }
    });
    return ResourceReportAbstract;
});